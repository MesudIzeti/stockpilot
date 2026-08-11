const pool = require('../config/db');
const { sendLowStockAlert, sendPoReminderEmail } = require('./emailService');

/**
 * Checks if a product needs a low-stock / out-of-stock alert after a quantity change.
 * Inserts a DB notification record and sends an email, respecting a 24-hour cooldown
 * so the owner is never spammed on back-to-back sales of the same item.
 *
 * Safe to call without await — all errors are caught internally and logged.
 *
 * @param {number} userId
 * @param {number} productId
 * @param {number} newQuantity  — the quantity that was just saved to the DB
 */
const checkAndNotify = async (userId, productId, newQuantity) => {
  try {
    const qty = parseFloat(newQuantity);

    // Fetch product details, user email, category and supplier in one query
    const result = await pool.query(
      `SELECT
         p.id, p.name, p.unit, p.min_stock_level,
         c.name  AS category_name,
         s.name  AS supplier_name,
         s.phone AS supplier_phone,
         u.email AS owner_email,
         u.name  AS owner_name
       FROM products p
       JOIN users u ON u.id = p.user_id
       LEFT JOIN categories c ON c.id = p.category_id
       LEFT JOIN suppliers  s ON s.id = p.supplier_id
       WHERE p.id = $1 AND p.user_id = $2`,
      [productId, userId]
    );

    if (!result.rows.length) return;
    const p = result.rows[0];
    const min = parseFloat(p.min_stock_level);

    // Decide whether this quantity level warrants an alert
    const isOutOfStock = qty === 0;
    const isLowStock   = min > 0 && qty <= min && qty > 0;

    if (!isOutOfStock && !isLowStock) {
      // Stock has recovered above the threshold — resolve any open alerts so the
      // cooldown resets and a fresh notification fires if stock drops again later.
      await pool.query(
        `UPDATE notifications
         SET resolved_at = NOW()
         WHERE user_id = $1 AND product_id = $2
           AND type IN ('LOW_STOCK', 'OUT_OF_STOCK')
           AND resolved_at IS NULL`,
        [userId, productId]
      );
      return;
    }

    const type    = isOutOfStock ? 'OUT_OF_STOCK' : 'LOW_STOCK';
    const title   = isOutOfStock ? 'Out of Stock!' : 'Low Stock Warning';
    const message = isOutOfStock
      ? `${p.name} is completely out of stock`
      : `${p.name} is running low — ${qty} ${p.unit} left (minimum: ${min})`;

    // Cooldown only applies to *unresolved* notifications of the same type within
    // 24 hours — so a recovery + re-drop within the same day still fires.
    const insertResult = await pool.query(
      `INSERT INTO notifications (type, title, message, product_id, user_id)
       SELECT $1::text, $2::text, $3::text, $4::int, $5::int
       WHERE NOT EXISTS (
         SELECT 1 FROM notifications
         WHERE user_id = $5::int AND product_id = $4::int AND type = $1::text
           AND resolved_at IS NULL
           AND created_at > NOW() - INTERVAL '24 hours'
       )
       RETURNING id`,
      [type, title, message, productId, userId]
    );

    if (insertResult.rows.length === 0) {
      console.log(`[Notification] Cooldown active — skipping ${type} for product ${productId}`);
      return;
    }

    // Send email — fire-and-forget so it never delays the API response
    sendLowStockAlert({
      toEmail:       p.owner_email,
      ownerName:     p.owner_name,
      productName:   p.name,
      quantity:      qty,
      unit:          p.unit,
      minStock:      min,
      category:      p.category_name,
      supplierName:  p.supplier_name,
      supplierPhone: p.supplier_phone,
      appUrl:        process.env.APP_URL || 'http://localhost:4200',
    }).catch(err => console.error('[Email] Send failed:', err.message));

  } catch (error) {
    // Never let notification errors surface to the caller
    console.error('[Notification] checkAndNotify error:', error.message);
  }
};

// ── Purchase Order Delivery Reminder ─────────────────────────────────────────
//
// Called on a 1-hour interval from index.js.
// Finds in-transit orders that are 24h+ old and haven't had a reminder sent,
// sends the email + creates an in-app notification, then marks reminder_sent_at
// so each order is reminded exactly once — even across server restarts.

const checkAndSendPoReminders = async () => {
  try {
    const result = await pool.query(
      `SELECT
         po.id, po.notes, po.created_at,
         s.name AS supplier_name,
         u.email AS owner_email,
         u.name  AS owner_name,
         u.id    AS owner_id,
         json_agg(
           json_build_object(
             'name',     p.name,
             'quantity', poi.quantity_ordered,
             'unit',     p.unit
           ) ORDER BY p.name
         ) AS items
       FROM purchase_orders po
       JOIN suppliers             s   ON s.id   = po.supplier_id
       JOIN users                 u   ON u.id   = po.user_id
       JOIN purchase_order_items  poi ON poi.order_id = po.id
       JOIN products              p   ON p.id   = poi.product_id
       WHERE po.status            = 'in_transit'
         AND po.created_at       <= NOW() - INTERVAL '24 hours'
         AND po.reminder_sent_at IS NULL
       GROUP BY po.id, s.name, u.email, u.name, u.id`
    );

    for (const order of result.rows) {
      try {
        // In-app notification (shows in the notification bell)
        const dateStr = new Date(order.created_at).toLocaleString('en-GB', {
          day: '2-digit', month: 'short', year: 'numeric',
          hour: '2-digit', minute: '2-digit',
        });
        await pool.query(
          `INSERT INTO notifications (type, title, message, product_id, user_id)
           VALUES ('PO_REMINDER', $1, $2, NULL, $3)`,
          [
            `Delivery Reminder — ${order.supplier_name}`,
            `You ordered from ${order.supplier_name} on ${dateStr}. Have the products arrived? Please confirm receipt in the system.`,
            order.owner_id,
          ]
        );

        // Email
        await sendPoReminderEmail({
          toEmail:      order.owner_email,
          ownerName:    order.owner_name,
          supplierName: order.supplier_name,
          orderedAt:    order.created_at,
          items:        order.items,
          notes:        order.notes,
          appUrl:       process.env.APP_URL || 'http://localhost:4200',
        });

        // Mark reminded — prevents any repeat
        await pool.query(
          'UPDATE purchase_orders SET reminder_sent_at = NOW() WHERE id = $1',
          [order.id]
        );

        console.log(`[PO Reminder] Sent for order #${order.id} → ${order.owner_email} (${order.supplier_name})`);
      } catch (err) {
        console.error(`[PO Reminder] Failed for order #${order.id}:`, err.message);
      }
    }
  } catch (err) {
    console.error('[PO Reminder] checkAndSendPoReminders error:', err.message);
  }
};

module.exports = { checkAndNotify, checkAndSendPoReminders };
