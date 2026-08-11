const pool = require('../config/db');

const getSummary = async (req, res) => {
    try{ 

        const userId = req.user.id;

        const [products,categories,todaySales,lowStock,outOfStock] = await Promise.all([
              pool.query('SELECT COUNT(*) FROM products WHERE user_id = $1 AND deleted_at IS NULL', [userId]),
        pool.query('SELECT COUNT(*) FROM categories WHERE user_id = $1 AND deleted_at IS NULL', [userId]),
      pool.query(
        `SELECT
           COUNT(DISTINCT s.id) AS count,
           COALESCE(SUM(si.total_price / si.exchange_rate), 0) -
           COALESCE((
             SELECT SUM(ri.total_price / ri.exchange_rate)
             FROM return_items ri
             JOIN returns r ON r.id = ri.return_id
             WHERE r.user_id = $1 AND DATE(r.created_at) = CURRENT_DATE
           ), 0) AS revenue
         FROM sales s
         JOIN sale_items si ON si.sale_id = s.id
         WHERE s.user_id = $1 AND DATE(s.created_at) = CURRENT_DATE`,
        [userId]
      ),
      pool.query(
        `SELECT COUNT(*) FROM products
         WHERE user_id = $1 AND deleted_at IS NULL AND quantity > 0 AND quantity <= min_stock_level`,
        [userId]
    ),
    pool.query(
        'SELECT COUNT(*) FROM products WHERE user_id = $1 AND deleted_at IS NULL AND quantity = 0',
        [userId]
    ),
]);
 res.json({
      total_products:     parseInt(products.rows[0].count),
      total_categories:   parseInt(categories.rows[0].count),
      today_sales_count:  parseInt(todaySales.rows[0].count),
      today_revenue:      parseFloat(todaySales.rows[0].revenue),
      low_stock_count:    parseInt(lowStock.rows[0].count),
      out_of_stock_count: parseInt(outOfStock.rows[0].count),
    });

} catch (error) {
    console.error('Dashboard summary error:', error);
    res.status(500).json({ message: 'Server error' });
}
};

const getLowStock = async (req, res) => {
    try{
        const result = await pool.query(
            `SELECT p.id, p.name, p.quantity, p.unit, p.min_stock_level,
              c.name AS category_name,
              s.name AS supplier_name,
              s.phone AS supplier_phone,
              s.email AS supplier_email
       FROM products p
       JOIN categories c ON p.category_id = c.id
       LEFT JOIN suppliers s ON p.supplier_id = s.id
       WHERE p.user_id = $1 AND p.deleted_at IS NULL AND p.quantity <= p.min_stock_level
       ORDER BY (p.quantity / NULLIF(p.min_stock_level, 0)) ASC`,
      [req.user.id]
        );

        res.json(result.rows);
    } catch (error) {
        console.error('Get low stock error:', error);
        res.status(500).json({ message: 'Server error' });
    }
    };
    const getExpiryWarnings = async (req, res) => {
  try {
    const { days = 7 } = req.query;

    const result = await pool.query(
      `SELECT p.id, p.name, p.quantity, p.unit, p.expiry_date,
              c.name AS category_name,
              (p.expiry_date - CURRENT_DATE) AS days_until_expiry
       FROM products p
       JOIN categories c ON p.category_id = c.id
       WHERE p.user_id = $1
         AND p.deleted_at IS NULL
         AND p.expiry_date IS NOT NULL
         AND p.expiry_date <= CURRENT_DATE + ($2 * INTERVAL '1 day')
         AND p.quantity > 0
       ORDER BY p.expiry_date ASC`,
      [req.user.id, parseInt(days)]
    );

    res.json(result.rows);
  } catch (error) {
    console.error('Expiry warnings error:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

module.exports = { getSummary, getLowStock, getExpiryWarnings };