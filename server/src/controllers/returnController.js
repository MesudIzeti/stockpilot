const pool = require('../config/db');
const { checkAndNotify } = require('../services/notificationService');

// POST /api/returns
// Body: { sale_id, reason, items: [{ sale_item_id, quantity }], notes }
const createReturn = async (req, res) => {
  const { sale_id, reason, items, notes } = req.body;

  if (!sale_id || !reason || !Array.isArray(items) || items.length === 0) {
    return res.status(400).json({ message: 'sale_id, reason, and items are required' });
  }
  if (!['refund', 'warranty', 'exchange'].includes(reason)) {
    return res.status(400).json({ message: 'Invalid reason. Must be refund, warranty, or exchange' });
  }
  for (const it of items) {
    if (!it.sale_item_id || !it.quantity || Number(it.quantity) < 1) {
      return res.status(400).json({ message: 'Each item must have a sale_item_id and quantity ≥ 1' });
    }
  }

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // 1. Verify sale belongs to tenant
    const saleResult = await client.query(
      'SELECT id FROM sales WHERE id = $1 AND user_id = $2',
      [sale_id, req.user.id]
    );
    if (!saleResult.rows.length) throw new Error('Sale not found');

    const saleItemIds = items.map(i => i.sale_item_id);

    // 2. Fetch original sale items to validate ownership and get unit prices
    const origResult = await client.query(
      `SELECT si.id, si.product_id, si.quantity::numeric AS original_qty,
              si.unit_price, si.cost_price, si.total_price,
              si.currency, si.exchange_rate
       FROM sale_items si
       JOIN sales s ON s.id = si.sale_id
       WHERE si.id = ANY($1::int[]) AND si.sale_id = $2 AND s.user_id = $3`,
      [saleItemIds, sale_id, req.user.id]
    );
    if (origResult.rows.length !== saleItemIds.length) {
      throw new Error('One or more items are invalid or do not belong to this sale');
    }
    const origMap = Object.fromEntries(origResult.rows.map(r => [r.id, r]));

    // 3. Fetch already-returned quantities per sale_item in this sale
    const alreadyResult = await client.query(
      `SELECT ri.sale_item_id, COALESCE(SUM(ri.quantity), 0)::numeric AS returned_qty
       FROM return_items ri
       JOIN returns r ON r.id = ri.return_id
       WHERE ri.sale_item_id = ANY($1::int[]) AND r.sale_id = $2
       GROUP BY ri.sale_item_id`,
      [saleItemIds, sale_id]
    );
    const returnedMap = Object.fromEntries(
      alreadyResult.rows.map(r => [r.sale_item_id, parseFloat(r.returned_qty)])
    );

    // 4. Validate requested quantities don't exceed remaining stock
    for (const it of items) {
      const orig   = origMap[it.sale_item_id];
      const alreadyReturned = returnedMap[it.sale_item_id] ?? 0;
      const remaining = parseFloat(orig.original_qty) - alreadyReturned;
      if (Number(it.quantity) > remaining) {
        throw new Error(
          `Cannot return ${it.quantity} unit(s) — only ${remaining} remaining for that item`
        );
      }
    }

    // 5. Compute total refund in USD (normalised by each item's exchange_rate)
    const totalRefund = items.reduce((sum, it) => {
      const orig = origMap[it.sale_item_id];
      const rate = parseFloat(orig.exchange_rate) || 1.0;
      return sum + (parseFloat(orig.unit_price) * Number(it.quantity)) / rate;
    }, 0);

    // 6. Per-tenant sequential return number — advisory lock serializes concurrent requests
    await client.query('SELECT pg_advisory_xact_lock($1)', [req.user.id]);
    const numResult = await client.query(
      'SELECT COALESCE(MAX(return_number), 0) + 1 AS next_num FROM returns WHERE user_id = $1',
      [req.user.id]
    );
    const returnNumber = numResult.rows[0].next_num;

    // 7. Insert return header
    const returnResult = await client.query(
      `INSERT INTO returns (return_number, sale_id, user_id, reason, notes, total_refund, performed_by)
       VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING *`,
      [returnNumber, sale_id, req.user.id, reason, notes || null,
       totalRefund, req.user.actualUserId]
    );
    const ret = returnResult.rows[0];

    // 8. Per item: insert return_item row and conditionally restore stock
    const restoredItems = []; // collected for fire-and-forget checkAndNotify after commit
    for (const it of items) {
      const orig = origMap[it.sale_item_id];
      const qty  = Number(it.quantity);

      await client.query(
        `INSERT INTO return_items
           (return_id, sale_item_id, product_id, quantity, unit_price, cost_price, total_price, currency, exchange_rate)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
        [ret.id, it.sale_item_id, orig.product_id, qty,
         orig.unit_price, orig.cost_price, parseFloat(orig.unit_price) * qty,
         orig.currency || 'USD', orig.exchange_rate || 1.0]
      );

      // Warranty = defective, written off — no stock restoration
      if (reason !== 'warranty') {
        const upd = await client.query(
          'UPDATE products SET quantity = quantity + $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2 RETURNING quantity',
          [qty, orig.product_id]
        );
        await client.query(
          `INSERT INTO stock_movements (product_id, type, quantity, reference_id, reason, user_id)
           VALUES ($1, 'RETURN', $2, $3, $4, $5)`,
          [orig.product_id, qty, ret.id, `Return #${returnNumber}`, req.user.actualUserId]
        );
        if (upd.rows.length > 0) {
          restoredItems.push({ productId: orig.product_id, newQty: parseFloat(upd.rows[0].quantity) });
        }
      }
    }

    await client.query('COMMIT');

    // Resolve open LOW_STOCK/OUT_OF_STOCK alerts for every restocked product so
    // the cooldown resets and a fresh email fires if stock drops again later.
    for (const { productId, newQty } of restoredItems) {
      checkAndNotify(req.user.id, productId, newQty);
    }

    res.status(201).json({
      message: 'Return processed successfully',
      return: { ...ret, total_refund: totalRefund },
    });
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('Create return error:', err.message);
    const status = err.message === 'Sale not found' ? 404 : 400;
    res.status(status).json({ message: err.message || 'Failed to process return' });
  } finally {
    client.release();
  }
};

// GET /api/returns
const getReturns = async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT r.id, r.return_number, r.sale_id, r.reason, r.notes,
              r.total_refund, r.created_at,
              MAX(u.name) AS performed_by,
              STRING_AGG(DISTINCT p.name, ', ') AS product_names
       FROM returns r
       LEFT JOIN users u ON u.id = r.performed_by
       LEFT JOIN return_items ri ON ri.return_id = r.id
       LEFT JOIN products p ON p.id = ri.product_id
       WHERE r.user_id = $1
       GROUP BY r.id
       ORDER BY r.created_at DESC`,
      [req.user.id]
    );
    res.json(result.rows);
  } catch (error) {
    console.error('Get returns error:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

// GET /api/returns/sale/:saleId
// Returns per-item return status with returned_quantity and remaining_quantity.
// already_returned = true only when every unit of every item has been returned.
const getSaleForReturn = async (req, res) => {
  try {
    const { saleId } = req.params;

    const saleResult = await pool.query(
      'SELECT id, total_amount, created_at FROM sales WHERE id = $1 AND user_id = $2',
      [saleId, req.user.id]
    );
    if (!saleResult.rows.length) {
      return res.status(404).json({ message: 'Sale not found' });
    }

    const itemsResult = await pool.query(
      `SELECT si.id, si.quantity::int AS quantity,
              si.unit_price, si.total_price, si.currency, si.exchange_rate,
              p.name AS product_name, p.unit,
              COALESCE(SUM(ri.quantity), 0)::int AS returned_quantity,
              (si.quantity - COALESCE(SUM(ri.quantity), 0))::int AS remaining_quantity,
              (si.quantity <= COALESCE(SUM(ri.quantity), 0)) AS is_returned
       FROM sale_items si
       JOIN products p ON p.id = si.product_id
       LEFT JOIN return_items ri ON ri.sale_item_id = si.id
       WHERE si.sale_id = $1
       GROUP BY si.id, p.name, p.unit`,
      [saleId]
    );

    const items = itemsResult.rows;
    const allReturned = items.length > 0 && items.every(i => i.is_returned);

    const returnsResult = await pool.query(
      'SELECT return_number FROM returns WHERE sale_id = $1 ORDER BY return_number',
      [saleId]
    );

    res.json({
      sale: saleResult.rows[0],
      items,
      already_returned: allReturned,
      return_number: returnsResult.rows[0]?.return_number ?? null,
    });
  } catch (error) {
    console.error('Get sale for return error:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

module.exports = { createReturn, getReturns, getSaleForReturn };
