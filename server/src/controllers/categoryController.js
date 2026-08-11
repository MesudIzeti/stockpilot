const pool = require('../config/db');

const getCategories = async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT c.id, c.name, c.description, c.created_at,
              COUNT(p.id) AS product_count
       FROM categories c
       LEFT JOIN products p ON p.category_id = c.id AND p.deleted_at IS NULL
       WHERE c.user_id = $1 AND c.deleted_at IS NULL
       GROUP BY c.id
       ORDER BY c.name ASC`,
      [req.user.id]
    );

    res.json(result.rows);
  } catch (error) {
    console.error('Get categories error:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

const createCategory = async (req, res) => {
  try {
    const { name, description } = req.body;

    if (!name) {
      return res.status(400).json({ message: 'Category name is required' });
    }

    const existing = await pool.query(
      'SELECT id FROM categories WHERE name = $1 AND user_id = $2 AND deleted_at IS NULL',
      [name, req.user.id]
    );

    if (existing.rows.length > 0) {
      return res.status(409).json({ message: 'Category already exists' });
    }

    const result = await pool.query(
      'INSERT INTO categories (name, description, user_id) VALUES ($1, $2, $3) RETURNING *',
      [name, description || null, req.user.id]
    );

    res.status(201).json(result.rows[0]);
  } catch (error) {
    console.error('Create category error:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

const updateCategory = async (req, res) => {
  try {
    const { id } = req.params;
    const { name, description } = req.body;

    if (!name) {
      return res.status(400).json({ message: 'Category name is required' });
    }

    const result = await pool.query(
      `UPDATE categories
       SET name = $1, description = $2
       WHERE id = $3 AND user_id = $4 AND deleted_at IS NULL
       RETURNING *`,
      [name, description || null, id, req.user.id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ message: 'Category not found' });
    }

    res.json(result.rows[0]);
  } catch (error) {
    console.error('Update category error:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

// Soft delete — only if no active (non-deleted) products remain in it
const deleteCategory = async (req, res) => {
  const { id } = req.params;
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // Lock the category row so concurrent requests can't race past the product check
    const catCheck = await client.query(
      'SELECT id FROM categories WHERE id = $1 AND user_id = $2 AND deleted_at IS NULL FOR UPDATE',
      [id, req.user.id]
    );

    if (catCheck.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({ message: 'Category not found' });
    }

    const products = await client.query(
      'SELECT COUNT(*) FROM products WHERE category_id = $1 AND user_id = $2 AND deleted_at IS NULL',
      [id, req.user.id]
    );

    if (parseInt(products.rows[0].count) > 0) {
      await client.query('ROLLBACK');
      return res.status(400).json({
        message: `Cannot delete: this category has ${products.rows[0].count} active products. Move or delete them first.`
      });
    }

    const result = await client.query(
      `UPDATE categories
       SET deleted_at = NOW()
       WHERE id = $1 AND user_id = $2 AND deleted_at IS NULL
       RETURNING id, name`,
      [id, req.user.id]
    );

    await client.query('COMMIT');
    res.json({
      message: `Category "${result.rows[0].name}" moved to trash. You have 30 days to restore it.`,
    });
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Delete category error:', error);
    res.status(500).json({ message: 'Server error' });
  } finally {
    client.release();
  }
};

// GET /api/categories/deleted
const getDeletedCategories = async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT id, name, description, deleted_at
       FROM categories
       WHERE user_id = $1
         AND deleted_at IS NOT NULL
         AND deleted_at > NOW() - INTERVAL '30 days'
       ORDER BY deleted_at DESC`,
      [req.user.id]
    );
    res.json(result.rows);
  } catch (error) {
    console.error('Get deleted categories error:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

// PUT /api/categories/:id/restore
const restoreCategory = async (req, res) => {
  try {
    const { id } = req.params;

    const result = await pool.query(
      `UPDATE categories
       SET deleted_at = NULL
       WHERE id = $1 AND user_id = $2
         AND deleted_at IS NOT NULL
         AND deleted_at > NOW() - INTERVAL '30 days'
       RETURNING id, name`,
      [id, req.user.id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ message: 'Category not found, already restored, or restore window expired' });
    }

    res.json({ message: `Category "${result.rows[0].name}" has been restored successfully.` });
  } catch (error) {
    console.error('Restore category error:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

module.exports = { getCategories, createCategory, updateCategory, deleteCategory, getDeletedCategories, restoreCategory };
