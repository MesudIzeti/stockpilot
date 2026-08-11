const pool = require('../config/db');
const bcrypt = require('bcrypt');

const createEmployee = async (req, res) => {
  if (req.user.role === 'employee') {
    return res.status(403).json({ message: 'Only business owners can manage employees' });
  }

  try {
    const { name, email, password } = req.body;

    if (!name || !email || !password) {
      return res.status(400).json({ message: 'Name, email, and password are required' });
    }

    const existing = await pool.query('SELECT id FROM users WHERE email = $1', [email]);
    if (existing.rows.length > 0) {
      return res.status(409).json({ message: 'An account with this email already exists' });
    }

    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(password, salt);

    // actualUserId for owners equals id (no owner_id in their token)
    const ownerId = req.user.actualUserId;

    const result = await pool.query(
      `INSERT INTO users (name, email, password, role, owner_id)
       VALUES ($1, $2, $3, 'employee', $4)
       RETURNING id, name, email, role, created_at`,
      [name, email, hashedPassword, ownerId]
    );

    res.status(201).json({
      message: 'Employee account created successfully',
      employee: result.rows[0],
    });
  } catch (error) {
    console.error('Create employee error:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

const getEmployees = async (req, res) => {
  if (req.user.role === 'employee') {
    return res.status(403).json({ message: 'Only business owners can manage employees' });
  }

  try {
    const ownerId = req.user.actualUserId;

    const result = await pool.query(
      `SELECT id, name, email, role, created_at
       FROM users
       WHERE owner_id = $1
       ORDER BY created_at DESC`,
      [ownerId]
    );

    res.json(result.rows);
  } catch (error) {
    console.error('Get employees error:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

const deleteEmployee = async (req, res) => {
  if (req.user.role === 'employee') {
    return res.status(403).json({ message: 'Only business owners can manage employees' });
  }

  try {
    const { id } = req.params;
    const ownerId = req.user.actualUserId;

    const result = await pool.query(
      'DELETE FROM users WHERE id = $1 AND owner_id = $2 RETURNING id',
      [id, ownerId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ message: 'Employee not found' });
    }

    res.json({ message: 'Employee removed successfully' });
  } catch (error) {
    console.error('Delete employee error:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

// GET /api/users/employees/:id/activity
const getEmployeeActivity = async (req, res) => {
  if (req.user.role === 'employee') {
    return res.status(403).json({ message: 'Only business owners can view employee activity' });
  }

  const { id } = req.params;
  const { from, to, type, search } = req.query;
  const ownerId       = req.user.id;
  const ownerActualId = req.user.actualUserId;

  try {
    // Verify the employee belongs to this owner
    const empResult = await pool.query(
      `SELECT id, name, email, created_at FROM users WHERE id = $1 AND owner_id = $2`,
      [id, ownerActualId]
    );
    if (!empResult.rows.length) {
      return res.status(404).json({ message: 'Employee not found' });
    }

    // Summary stats (always unfiltered)
    const summaryResult = await pool.query(
      `SELECT
        (SELECT COUNT(*) FROM sales    WHERE performed_by = $1 AND user_id = $2)::int            AS sales_count,
        (SELECT COALESCE(SUM(total_amount), 0) FROM sales WHERE performed_by = $1 AND user_id = $2) AS total_revenue,
        (SELECT COUNT(*) FROM returns  WHERE performed_by = $1 AND user_id = $2)::int            AS returns_count,
        (SELECT COALESCE(SUM(total_refund), 0) FROM returns WHERE performed_by = $1 AND user_id = $2) AS total_refunded,
        (SELECT COUNT(*) FROM products WHERE created_by = $1 AND user_id = $2)::int              AS products_added,
        (SELECT COUNT(*) FROM stock_movements sm
           JOIN products p ON p.id = sm.product_id
           WHERE sm.user_id = $1 AND p.user_id = $2
             AND sm.type IN ('IN','ADJUSTMENT')
             AND NOT (sm.type = 'IN' AND sm.reason = 'Initial stock')
             AND NOT (sm.type = 'IN' AND sm.reason = 'Initial stock (batch)')
             AND NOT (sm.type = 'IN' AND sm.reason = 'Initial stock (CSV import)'))::int         AS stock_adjustments`,
      [id, ownerId]
    );

    // Activity feed — build filters dynamically
    const params  = [id, ownerId];
    let pc = 2;
    const filters = [];

    if (from) { pc++; filters.push(`activity_date >= $${pc}`); params.push(from); }
    if (to)   { pc++; filters.push(`activity_date <= $${pc}`); params.push(to + ' 23:59:59'); }
    if (type && type !== 'all') { pc++; filters.push(`activity_type = $${pc}`); params.push(type); }
    if (search) { pc++; filters.push(`product_context ILIKE $${pc}`); params.push(`%${search}%`); }

    const whereClause = filters.length ? 'WHERE ' + filters.join(' AND ') : '';

    const activitiesResult = await pool.query(
      `WITH activities AS (
        -- Sales processed by this employee
        SELECT
          'sale'::text                                          AS activity_type,
          s.id,
          s.created_at                                          AS activity_date,
          s.total_amount::numeric                               AS amount,
          NULL::numeric                                         AS refund_amount,
          COALESCE(STRING_AGG(DISTINCT p.name, ', '), '')       AS product_context,
          COUNT(si.id)::int                                     AS item_count,
          NULL::text                                            AS reason,
          NULL::numeric                                         AS qty,
          NULL::text                                            AS movement_type
        FROM sales s
        LEFT JOIN sale_items si ON si.sale_id    = s.id
        LEFT JOIN products   p  ON p.id          = si.product_id
        WHERE s.performed_by = $1 AND s.user_id = $2
        GROUP BY s.id

        UNION ALL

        -- Returns processed by this employee
        SELECT
          'return'::text,
          r.id,
          r.created_at,
          NULL::numeric,
          r.total_refund::numeric,
          COALESCE(STRING_AGG(DISTINCT p.name, ', '), ''),
          COUNT(ri.id)::int,
          r.reason,
          NULL::numeric,
          NULL::text
        FROM returns r
        LEFT JOIN return_items ri ON ri.return_id  = r.id
        LEFT JOIN products     p  ON p.id          = ri.product_id
        WHERE r.performed_by = $1 AND r.user_id = $2
        GROUP BY r.id

        UNION ALL

        -- Products added to the system by this employee
        SELECT
          'product_added'::text,
          pr.id,
          pr.created_at,
          pr.price::numeric,
          NULL::numeric,
          pr.name,
          NULL::int,
          NULL::text,
          pr.quantity::numeric,
          NULL::text
        FROM products pr
        WHERE pr.created_by = $1 AND pr.user_id = $2

        UNION ALL

        -- Manual stock updates (excludes initial-stock and sale/return auto-movements)
        SELECT
          'stock_adjustment'::text,
          sm.id,
          sm.created_at,
          NULL::numeric,
          NULL::numeric,
          p.name,
          NULL::int,
          sm.reason,
          sm.quantity::numeric,
          sm.type
        FROM stock_movements sm
        JOIN products p ON p.id = sm.product_id
        WHERE sm.user_id = $1 AND p.user_id = $2
          AND sm.type IN ('IN', 'ADJUSTMENT')
          AND NOT (sm.type = 'IN' AND sm.reason IN (
            'Initial stock',
            'Initial stock (batch)',
            'Initial stock (CSV import)'
          ))
      )
      SELECT * FROM activities
      ${whereClause}
      ORDER BY activity_date DESC
      LIMIT 500`,
      params
    );

    res.json({
      employee:   empResult.rows[0],
      summary:    summaryResult.rows[0],
      activities: activitiesResult.rows,
    });
  } catch (error) {
    console.error('Get employee activity error:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

module.exports = { createEmployee, getEmployees, deleteEmployee, getEmployeeActivity };
