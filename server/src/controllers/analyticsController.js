const pool = require('../config/db');
const { getRates, rateForCurrency } = require('../services/exchangeRateService');

// All monetary aggregations divide by si/ri.exchange_rate to normalise to USD.
// Existing rows (before migration 011) have exchange_rate = 1.0 (the DEFAULT),
// so division is a no-op for them — perfect backwards compatibility.

const getRevenueTrend = async (req, res) => {
  try {
    const { days = 30 } = req.query;

    const result = await pool.query(
      `SELECT DATE(s.created_at) AS date,
              COUNT(DISTINCT s.id) AS sales_count,
              ROUND((
                SUM(si.total_price / si.exchange_rate)
                - COALESCE(SUM(ri.total_price / ri.exchange_rate), 0)
              )::numeric, 2) AS revenue,
              ROUND((
                SUM(((si.unit_price - COALESCE(si.cost_price, 0)) * si.quantity) / si.exchange_rate)
                - COALESCE(SUM(((ri.unit_price - COALESCE(ri.cost_price, 0)) * ri.quantity) / ri.exchange_rate), 0)
              )::numeric, 2) AS profit
       FROM sales s
       JOIN sale_items si ON si.sale_id = s.id
       LEFT JOIN return_items ri ON ri.sale_item_id = si.id
       WHERE s.user_id = $1
         AND s.created_at >= CURRENT_DATE - ($2 * INTERVAL '1 day')
       GROUP BY DATE(s.created_at)
       ORDER BY date ASC`,
      [req.user.id, parseInt(days)]
    );

    res.json(result.rows);
  } catch (error) {
    console.error('Revenue trend error:', error);
    res.status(500).json({ message: 'Server Error' });
  }
};

const getCategoryPerformance = async (req, res) => {
  try {
    const { days = 30 } = req.query;

    const result = await pool.query(
      `SELECT c.id, c.name AS category_name,
              COUNT(DISTINCT s.id) AS total_sales,
              SUM(si.quantity) - COALESCE(SUM(ri.quantity), 0) AS total_units_sold,
              ROUND((
                SUM(si.total_price / si.exchange_rate)
                - COALESCE(SUM(ri.total_price / ri.exchange_rate), 0)
              )::numeric, 2) AS revenue,
              ROUND((
                SUM(((si.unit_price - COALESCE(si.cost_price, 0)) * si.quantity) / si.exchange_rate)
                - COALESCE(SUM(((ri.unit_price - COALESCE(ri.cost_price, 0)) * ri.quantity) / ri.exchange_rate), 0)
              )::numeric, 2) AS profit,
              CASE
                WHEN SUM(si.total_price / si.exchange_rate) - COALESCE(SUM(ri.total_price / ri.exchange_rate), 0) > 0
                THEN ROUND(
                  ((SUM(((si.unit_price - COALESCE(si.cost_price, 0)) * si.quantity) / si.exchange_rate)
                    - COALESCE(SUM(((ri.unit_price - COALESCE(ri.cost_price, 0)) * ri.quantity) / ri.exchange_rate), 0)) /
                   (SUM(si.total_price / si.exchange_rate)
                    - COALESCE(SUM(ri.total_price / ri.exchange_rate), 0)) * 100)::numeric, 1)
                ELSE 0
              END AS margin_percent
       FROM categories c
       JOIN products p ON p.category_id = c.id
       JOIN sale_items si ON si.product_id = p.id
       LEFT JOIN return_items ri ON ri.sale_item_id = si.id
       JOIN sales s ON si.sale_id = s.id
       WHERE s.user_id = $1
         AND s.created_at >= CURRENT_DATE - ($2 * INTERVAL '1 day')
       GROUP BY c.id
       ORDER BY revenue DESC`,
      [req.user.id, parseInt(days)]
    );

    res.json(result.rows);
  } catch (error) {
    console.error('Category performance error:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

const getTopProducts = async (req, res) => {
  try {
    const { days = 30, limit = 10 } = req.query;

    const result = await pool.query(
      `SELECT p.id, p.name, p.unit,
              c.name AS category_name,
              SUM(si.quantity) - COALESCE(SUM(ri.quantity), 0) AS total_units_sold,
              ROUND((
                SUM(si.total_price / si.exchange_rate)
                - COALESCE(SUM(ri.total_price / ri.exchange_rate), 0)
              )::numeric, 2) AS total_revenue,
              ROUND((
                SUM(((si.unit_price - COALESCE(si.cost_price, 0)) * si.quantity) / si.exchange_rate)
                - COALESCE(SUM(((ri.unit_price - COALESCE(ri.cost_price, 0)) * ri.quantity) / ri.exchange_rate), 0)
              )::numeric, 2) AS total_profit,
              COUNT(DISTINCT s.id) AS times_sold
       FROM products p
       JOIN categories c ON p.category_id = c.id
       JOIN sale_items si ON si.product_id = p.id
       LEFT JOIN return_items ri ON ri.sale_item_id = si.id
       JOIN sales s ON si.sale_id = s.id
       WHERE s.user_id = $1
         AND s.created_at >= CURRENT_DATE - ($2 * INTERVAL '1 day')
       GROUP BY p.id, c.name
       ORDER BY total_units_sold DESC
       LIMIT $3`,
      [req.user.id, parseInt(days), parseInt(limit)]
    );

    res.json(result.rows);
  } catch (error) {
    console.error('Top products error:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

const getSalesVelocity = async (req, res) => {
  try {
    const { days = 30 } = req.query;
    const daysInt = parseInt(days);

    const result = await pool.query(
      `SELECT p.id, p.name,
              p.quantity AS current_stock,
              p.unit,
              p.min_stock_level,
              COALESCE(SUM(si.quantity), 0) AS sold_in_period,
              ROUND((COALESCE(SUM(si.quantity), 0) / $2::numeric)::numeric, 2) AS units_per_day,
              CASE
                WHEN COALESCE(SUM(si.quantity), 0) = 0 THEN NULL
                ELSE ROUND((p.quantity / (COALESCE(SUM(si.quantity), 0) / $2::numeric))::numeric, 0)
              END AS days_until_stockout
       FROM products p
       LEFT JOIN sale_items si ON si.product_id = p.id
       LEFT JOIN sales s ON s.id = si.sale_id
         AND s.user_id = $1
         AND s.created_at >= CURRENT_DATE - ($2 * INTERVAL '1 day')
       WHERE p.user_id = $1 AND p.quantity > 0 AND p.deleted_at IS NULL
       GROUP BY p.id
       ORDER BY days_until_stockout ASC NULLS LAST`,
      [req.user.id, daysInt]
    );

    res.json(result.rows);
  } catch (error) {
    console.error('Sales velocity error:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

// ── Exchange Rates (server-side proxy — avoids browser CORS) ──────────────────

const getExchangeRates = async (req, res) => {
  try {
    const rates = await getRates();
    res.json({ rates, base: 'USD' });
  } catch (err) {
    console.error('Exchange rates error:', err);
    res.status(500).json({ message: 'Could not load exchange rates' });
  }
};

module.exports = { getRevenueTrend, getCategoryPerformance, getTopProducts, getSalesVelocity, getExchangeRates };
