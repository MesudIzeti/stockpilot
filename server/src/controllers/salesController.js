const pool = require('../config/db');
const { checkAndNotify } = require('../services/notificationService');
const { getRates, rateForCurrency } = require('../services/exchangeRateService');

const createSale = async (req, res) => {
  const { items, notes } = req.body;

  if (!items || !Array.isArray(items) || items.length === 0) {
    return res.status(400).json({ message: 'Sale items are required' });
  }

  // Fetch exchange rates once before the transaction (network call outside the DB tx)
  let rates = {};
  try {
    rates = await getRates();
  } catch (_) {
    // If rate fetch fails, fall back to 1.0 for all currencies (USD equivalence)
    rates = {};
  }

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    let totalAmount = 0;
    const processedItems = [];

    for (const item of items) {
      if (!item.product_id || !item.quantity || parseFloat(item.quantity) <= 0) {
        throw new Error('Each item must have a product_id and a valid quantity');
      }

      const productResult = await client.query(
        'SELECT * FROM products WHERE id = $1 AND user_id = $2 AND deleted_at IS NULL FOR UPDATE',
        [item.product_id, req.user.id]
      );

      if (productResult.rows.length === 0) {
        throw new Error(`Product ID ${item.product_id} not found`);
      }

      const product = productResult.rows[0];

      if (parseFloat(product.quantity) < parseFloat(item.quantity)) {
        throw new Error(
          `Insufficient stock for "${product.name}". Available: ${product.quantity} ${product.unit}, requested: ${item.quantity}`
        );
      }

      const currency     = product.currency || 'USD';
      const exchangeRate = rateForCurrency(rates, currency);
      const itemTotal    = parseFloat(product.price) * parseFloat(item.quantity);
      // Normalise to USD before summing so mixed-currency sales have a meaningful total.
      // exchange_rate = units of this currency per 1 USD, so dividing converts to USD.
      totalAmount += itemTotal / exchangeRate;

      processedItems.push({
        product_id:      item.product_id,
        product_name:    product.name,
        quantity:        item.quantity,
        unit_price:      product.price,
        cost_price:      product.cost_price,
        total_price:     itemTotal,
        currency,
        exchange_rate:   exchangeRate,
        new_quantity:    parseFloat(product.quantity) - parseFloat(item.quantity),
        min_stock_level: parseFloat(product.min_stock_level),
        unit:            product.unit,
      });
    }

    const saleResult = await client.query(
      'INSERT INTO sales (total_amount, notes, user_id, performed_by) VALUES ($1, $2, $3, $4) RETURNING *',
      [totalAmount, notes || null, req.user.id, req.user.actualUserId]
    );
    const sale = saleResult.rows[0];

    for (const item of processedItems) {
      await client.query(
        `INSERT INTO sale_items
           (sale_id, product_id, quantity, unit_price, cost_price, total_price, currency, exchange_rate)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
        [
          sale.id, item.product_id, item.quantity,
          item.unit_price, item.cost_price, item.total_price,
          item.currency, item.exchange_rate,
        ]
      );

      await client.query(
        'UPDATE products SET quantity = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2',
        [item.new_quantity, item.product_id]
      );

      await client.query(
        `INSERT INTO stock_movements (product_id, type, quantity, reference_id, reason, user_id)
         VALUES ($1, 'OUT', $2, $3, $4, $5)`,
        [item.product_id, item.quantity, sale.id, `Sale #${sale.id}`, req.user.actualUserId]
      );
    }

    await client.query('COMMIT');

    for (const item of processedItems) {
      checkAndNotify(req.user.id, item.product_id, item.new_quantity);
    }

    res.status(201).json({
      message: 'Sale created successfully',
      sale: {
        id:           sale.id,
        total_amount: totalAmount,
        notes:        sale.notes,
        created_at:   sale.created_at,
        items:        processedItems,
      },
    });
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('Create sale error:', err.message);
    res.status(400).json({ message: err.message || 'Failed to create sale' });
  } finally {
    client.release();
  }
};

const getSales = async (req, res) => {
  try {
    const { from, to } = req.query;
    const limit = Math.min(parseInt(req.query.limit, 10) || 50, 500);
    const isEmployee = req.user.actualUserId !== req.user.id;

    let query = `
      SELECT s.id, s.total_amount, s.notes, s.created_at,
             COUNT(si.id)                        AS item_count,
             STRING_AGG(DISTINCT p.name, ', ')   AS product_names,
             STRING_AGG(DISTINCT c.name, ', ')   AS category_names,
             MAX(u.name)                          AS performed_by,
             (MAX(ret.id) IS NOT NULL)            AS has_return,
             MAX(ret.return_number)               AS return_number,
             (
               (SELECT COALESCE(SUM(si2.quantity), 0) FROM sale_items si2 WHERE si2.sale_id = s.id) > 0
               AND
               (SELECT COALESCE(SUM(si2.quantity), 0) FROM sale_items si2 WHERE si2.sale_id = s.id)
               <=
               (SELECT COALESCE(SUM(ri2.quantity), 0) FROM return_items ri2
                  JOIN returns r2 ON r2.id = ri2.return_id WHERE r2.sale_id = s.id)
             )                                   AS all_returned,
             (SELECT si3.currency FROM sale_items si3 WHERE si3.sale_id = s.id LIMIT 1) AS sale_currency,
             -- USD-normalised total computed from items (correct for mixed-currency sales)
             COALESCE((
               SELECT SUM(si4.total_price / si4.exchange_rate)
               FROM sale_items si4 WHERE si4.sale_id = s.id
             ), 0)                               AS usd_total
      FROM sales s
      LEFT JOIN sale_items si  ON si.sale_id    = s.id
      LEFT JOIN products p     ON p.id          = si.product_id
      LEFT JOIN categories c   ON c.id          = p.category_id
      LEFT JOIN users u        ON u.id          = s.performed_by
      LEFT JOIN returns ret    ON ret.sale_id   = s.id
      WHERE s.user_id = $1
    `;
    const params = [req.user.id];
    let paramCount = 1;

    if (isEmployee) {
      paramCount++;
      query += ` AND s.performed_by = $${paramCount}`;
      params.push(req.user.actualUserId);
    }

    if (from) {
      paramCount++;
      query += ` AND s.created_at >= $${paramCount}`;
      params.push(from);
    }

    if (to) {
      paramCount++;
      query += ` AND s.created_at <= $${paramCount}`;
      params.push(to + ' 23:59:59');
    }

    paramCount++;
    query += ` GROUP BY s.id ORDER BY s.created_at DESC LIMIT $${paramCount}`;
    params.push(limit);

    const result = await pool.query(query, params);
    res.json(result.rows);
  } catch (error) {
    console.error('Get sales error:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

const getSale = async (req, res) => {
  try {
    const { id } = req.params;

    const saleResult = await pool.query(
      'SELECT * FROM sales WHERE id = $1 AND user_id = $2',
      [id, req.user.id]
    );

    if (saleResult.rows.length === 0) {
      return res.status(404).json({ message: 'Sale not found' });
    }

    const itemsResult = await pool.query(
      `SELECT si.id, si.quantity, si.unit_price, si.cost_price, si.total_price,
              si.currency, si.exchange_rate,
              p.name AS product_name, p.unit, p.sku
       FROM sale_items si
       JOIN products p ON p.id = si.product_id
       WHERE si.sale_id = $1`,
      [id]
    );

    res.json({
      ...saleResult.rows[0],
      items: itemsResult.rows,
    });
  } catch (error) {
    console.error('Get sale error:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

module.exports = { createSale, getSales, getSale };
