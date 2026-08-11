const pool = require('../config/db');

const getNotifications = async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT n.id, n.type, n.title, n.message, n.is_read, n.created_at,
              p.name AS product_name
       FROM notifications n
       LEFT JOIN products p ON p.id = n.product_id
       WHERE n.user_id = $1
       ORDER BY n.is_read ASC, n.created_at DESC`,
      [req.user.id]
    );

    const unread_count = result.rows.filter(n => !n.is_read).length;

    res.json({
      unread_count,
      notifications: result.rows,
    });
  } catch (error) {
    console.error('Get notifications error:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

const markAsRead = async (req, res) => {
  try {
    const { id } = req.params;

    const result = await pool.query(
      'UPDATE notifications SET is_read = TRUE WHERE id = $1 AND user_id = $2 RETURNING id',
      [id, req.user.id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ message: 'Notification not found' });
    }

    res.json({ message: 'Notification marked as read' });
  } catch (error) {
    console.error('Mark as read error:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

const markAllRead = async (req, res) => {
  try {
    const result = await pool.query(
      'UPDATE notifications SET is_read = TRUE WHERE user_id = $1 AND is_read = FALSE',
      [req.user.id]
    );

    res.json({ message: `${result.rowCount} notifications marked as read` });
  } catch (error) {
    console.error('Mark all read error:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

module.exports = { getNotifications, markAsRead, markAllRead };