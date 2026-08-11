const pool = require('../config/db');
const { checkAndNotify } = require('../services/notificationService');

// GET /api/purchase-orders  — returns only in_transit orders for this tenant
const getOrders = async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT
         po.id, po.status, po.notes, po.created_at,
         s.id   AS supplier_id,
         s.name AS supplier_name,
         json_agg(
           json_build_object(
             'id',               poi.id,
             'product_id',       poi.product_id,
             'product_name',     p.name,
             'unit',             p.unit,
             'quantity_ordered', poi.quantity_ordered,
             'current_stock',    p.quantity
           ) ORDER BY p.name
         ) AS items
       FROM purchase_orders po
       JOIN suppliers s             ON s.id   = po.supplier_id
       JOIN purchase_order_items poi ON poi.order_id = po.id
       JOIN products p              ON p.id   = poi.product_id
       WHERE po.user_id = $1 AND po.status = 'in_transit'
       GROUP BY po.id, s.id, s.name
       ORDER BY po.created_at DESC`,
      [req.user.id]
    );
    res.json(result.rows);
  } catch (error) {
    console.error('Get purchase orders error:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

// GET /api/purchase-orders/reorder-candidates/:supplierId
// Returns products linked to this supplier that are out of stock or at/below min stock level
const getReorderCandidates = async (req, res) => {
  try {
    const { supplierId } = req.params;

    const supplierCheck = await pool.query(
      'SELECT id FROM suppliers WHERE id = $1 AND user_id = $2',
      [supplierId, req.user.id]
    );
    if (supplierCheck.rows.length === 0) {
      return res.status(404).json({ message: 'Supplier not found' });
    }

    const result = await pool.query(
      `SELECT p.id, p.name, p.quantity, p.unit, p.min_stock_level,
              c.name AS category_name
       FROM products p
       JOIN categories c ON c.id = p.category_id
       WHERE p.user_id = $1
         AND p.supplier_id = $2
         AND p.deleted_at IS NULL
         AND (p.quantity = 0 OR p.quantity <= p.min_stock_level)
       ORDER BY p.quantity ASC, p.name ASC`,
      [req.user.id, supplierId]
    );
    res.json(result.rows);
  } catch (error) {
    console.error('Get reorder candidates error:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

// POST /api/purchase-orders
const createOrder = async (req, res) => {
  const { supplier_id, items, notes } = req.body;

  if (!supplier_id || !items || !Array.isArray(items) || items.length === 0) {
    return res.status(400).json({ message: 'Supplier and at least one item are required' });
  }

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const supplierCheck = await client.query(
      'SELECT id FROM suppliers WHERE id = $1 AND user_id = $2',
      [supplier_id, req.user.id]
    );
    if (supplierCheck.rows.length === 0) {
      throw new Error('Supplier not found');
    }

    const orderResult = await client.query(
      `INSERT INTO purchase_orders (supplier_id, user_id, status, notes)
       VALUES ($1, $2, 'in_transit', $3) RETURNING *`,
      [supplier_id, req.user.id, notes || null]
    );
    const order = orderResult.rows[0];

    for (const item of items) {
      if (!item.product_id || !item.quantity_ordered || parseFloat(item.quantity_ordered) <= 0) {
        throw new Error('Each item requires a product and a valid quantity');
      }

      const productCheck = await client.query(
        'SELECT id FROM products WHERE id = $1 AND user_id = $2',
        [item.product_id, req.user.id]
      );
      if (productCheck.rows.length === 0) {
        throw new Error('Product not found');
      }

      await client.query(
        `INSERT INTO purchase_order_items (order_id, product_id, quantity_ordered)
         VALUES ($1, $2, $3)`,
        [order.id, item.product_id, item.quantity_ordered]
      );
    }

    await client.query('COMMIT');
    res.status(201).json({ message: 'Purchase order created', id: order.id });
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('Create purchase order error:', err.message);
    res.status(400).json({ message: err.message || 'Failed to create order' });
  } finally {
    client.release();
  }
};

// PUT /api/purchase-orders/:id/receive
const receiveOrder = async (req, res) => {
  const { id } = req.params;

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const orderResult = await client.query(
      `SELECT id FROM purchase_orders
       WHERE id = $1 AND user_id = $2 AND status = 'in_transit'`,
      [id, req.user.id]
    );
    if (orderResult.rows.length === 0) {
      return res.status(404).json({ message: 'Order not found or already processed' });
    }

    const items = await client.query(
      'SELECT * FROM purchase_order_items WHERE order_id = $1',
      [id]
    );

    const receivedItems = []; // collected for fire-and-forget checkAndNotify after commit
    for (const item of items.rows) {
      const upd = await client.query(
        `UPDATE products
         SET quantity = quantity + $1, updated_at = CURRENT_TIMESTAMP
         WHERE id = $2 AND deleted_at IS NULL
         RETURNING quantity`,
        [item.quantity_ordered, item.product_id]
      );

      await client.query(
        `INSERT INTO stock_movements
           (product_id, type, quantity, reference_id, reason, user_id)
         VALUES ($1, 'IN', $2, $3, $4, $5)`,
        [
          item.product_id,
          item.quantity_ordered,
          parseInt(id),
          `Received from supplier (PO #${id})`,
          req.user.actualUserId,
        ]
      );

      if (upd.rows.length > 0) {
        receivedItems.push({ productId: item.product_id, newQty: parseFloat(upd.rows[0].quantity) });
      }
    }

    await client.query(
      `UPDATE purchase_orders
       SET status = 'received', updated_at = CURRENT_TIMESTAMP
       WHERE id = $1`,
      [id]
    );

    await client.query('COMMIT');
    res.json({ message: 'Order received and stock updated' });

    // Resolve open LOW_STOCK/OUT_OF_STOCK alerts for every restocked product so
    // the cooldown resets and a fresh email fires if stock drops again later.
    for (const { productId, newQty } of receivedItems) {
      checkAndNotify(req.user.id, productId, newQty);
    }
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('Receive order error:', err.message);
    res.status(500).json({ message: err.message || 'Failed to receive order' });
  } finally {
    client.release();
  }
};

// PUT /api/purchase-orders/:id/cancel
const cancelOrder = async (req, res) => {
  try {
    const { id } = req.params;

    const result = await pool.query(
      `UPDATE purchase_orders
       SET status = 'cancelled', updated_at = CURRENT_TIMESTAMP
       WHERE id = $1 AND user_id = $2 AND status = 'in_transit'
       RETURNING id`,
      [id, req.user.id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ message: 'Order not found or already processed' });
    }

    res.json({ message: 'Order cancelled' });
  } catch (error) {
    console.error('Cancel order error:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

module.exports = { getOrders, getReorderCandidates, createOrder, receiveOrder, cancelOrder };
