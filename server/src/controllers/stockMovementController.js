const pool = require('../config/db');
const { checkAndNotify } = require('../services/notificationService');


const addStock = async (req, res) => {
  try {
    const { product_id, quantity, reason } = req.body;

    if (!product_id || !quantity || parseFloat(quantity) <= 0) {
      return res.status(400).json({ message: 'Product and a positive quantity are required' });
    }

    const addedQty = parseFloat(quantity);
    const client = await pool.connect();
    try {
      await client.query('BEGIN');

      // Lock row inside transaction — eliminates the stale-read race and guards soft-delete
      const productResult = await client.query(
        'SELECT id, name, quantity, unit FROM products WHERE id = $1 AND user_id = $2 AND deleted_at IS NULL FOR UPDATE',
        [product_id, req.user.id]
      );

      if (productResult.rows.length === 0) {
        await client.query('ROLLBACK');
        return res.status(404).json({ message: 'Product not found' });
      }

      const product = productResult.rows[0];
      const newQuantity = parseFloat(product.quantity) + addedQty;

      // Atomic increment — concurrent writers see the correct final value
      await client.query(
        'UPDATE products SET quantity = quantity + $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2',
        [addedQty, product_id]
      );

      await client.query(
        `INSERT INTO stock_movements (product_id, type, quantity, reason, user_id)
         VALUES ($1, 'IN', $2, $3, $4)`,
        [product_id, addedQty, reason || 'Stock replenishment', req.user.actualUserId]
      );

      await client.query('COMMIT');

      res.json({
        message: `Stock updated for "${product.name}": ${product.quantity} → ${newQuantity} ${product.unit}`,
        product_id,
        previous_quantity: parseFloat(product.quantity),
        added: addedQty,
        new_quantity: newQuantity,
      });

      // Fire-and-forget — may resolve an open LOW_STOCK/OUT_OF_STOCK alert
      checkAndNotify(req.user.id, product_id, newQuantity);

    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }
  } catch (error) {
    console.error('Add stock error:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

const adjustStock = async (req, res) => {
  try {
    const { product_id, new_quantity, reason } = req.body;

    if (!product_id || new_quantity === undefined || new_quantity === null) {
      return res.status(400).json({ message: 'Product and new quantity are required' });
    }

    const newQty = parseFloat(new_quantity);
    if (newQty < 0) {
      return res.status(400).json({ message: 'Quantity cannot be negative' });
    }

    const client = await pool.connect();
    try {
      await client.query('BEGIN');

      // Lock row inside transaction — ensures the diff in the audit log reflects the
      // actual pre-adjustment quantity, not a stale value from before concurrent writes.
      const productResult = await client.query(
        'SELECT id, name, quantity, unit FROM products WHERE id = $1 AND user_id = $2 AND deleted_at IS NULL FOR UPDATE',
        [product_id, req.user.id]
      );

      if (productResult.rows.length === 0) {
        await client.query('ROLLBACK');
        return res.status(404).json({ message: 'Product not found' });
      }

      const product = productResult.rows[0];
      const prevQty = parseFloat(product.quantity);
      const diff = Math.abs(newQty - prevQty);

      await client.query(
        'UPDATE products SET quantity = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2',
        [newQty, product_id]
      );

      await client.query(
        `INSERT INTO stock_movements (product_id, type, quantity, reason, user_id)
         VALUES ($1, 'ADJUSTMENT', $2, $3, $4)`,
        [
          product_id,
          diff,
          reason || `Physical count adjustment: ${prevQty} → ${newQty}`,
          req.user.actualUserId,
        ]
      );

      await client.query('COMMIT');

      res.json({
        message: `Stock adjusted for "${product.name}": ${prevQty} → ${newQty} ${product.unit}`,
        product_id,
        previous_quantity: prevQty,
        new_quantity: newQty,
      });

      // Fire-and-forget — notify owner (req.user.id = effective owner ID after middleware)
      checkAndNotify(req.user.id, product_id, newQty);

    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }
  } catch (error) {
    console.error('Adjust stock error:', error);
    res.status(500).json({ message: 'Server error' });
  }
};
const getProductMovements = async (req, res) => {
  try {
    const { productId } = req.params;

    const product = await pool.query(
      'SELECT id, name, quantity, unit FROM products WHERE id = $1 AND user_id = $2',
      [productId, req.user.id]
    );

    if (product.rows.length === 0) {
      return res.status(404).json({ message: 'Product not found' });
    }

    const result = await pool.query(
      `SELECT sm.id, sm.type, sm.quantity, sm.reason, sm.reference_id, sm.created_at,
              u.name AS performed_by
       FROM stock_movements sm
       JOIN users u ON u.id = sm.user_id
       WHERE sm.product_id = $1
       ORDER BY sm.created_at DESC`,
      [productId]
    );

    res.json({
      product: product.rows[0],
      movements: result.rows,
    });
  } catch (error) {
    console.error('Get movements error:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

module.exports = {
    addStock,
    adjustStock,
    getProductMovements
};