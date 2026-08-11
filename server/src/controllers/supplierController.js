const pool = require('../config/db');

const getSuppliers = async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT s.id, s.name, s.contact_person, s.email, s.phone, s.address, s.notes, s.created_at,
              COUNT(p.id) AS product_count
       FROM suppliers s
       LEFT JOIN products p ON p.supplier_id = s.id AND p.deleted_at IS NULL
       WHERE s.user_id = $1
       GROUP BY s.id
       ORDER BY s.name ASC`,
      [req.user.id]
    );

    res.json(result.rows);
  } catch (error) {
    console.error('Get suppliers error:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

const createSupplier = async (req, res) => {
  try {
    const { name, contact_person, email, phone, address, notes } = req.body;

    if (!name) {
      return res.status(400).json({ message: 'Supplier name is required' });
    }

    const result = await pool.query(
      `INSERT INTO suppliers (name, contact_person, email, phone, address, notes, user_id)
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       RETURNING *`,
      [name, contact_person || null, email || null, phone || null, address || null, notes || null, req.user.id]
    );

    res.status(201).json(result.rows[0]);
  } catch (error) {
    console.error('Create supplier error:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

const updateSupplier = async (req, res) => {
  try {
    const { id } = req.params;
    const { name, contact_person, email, phone, address, notes } = req.body;

    if (!name) {
      return res.status(400).json({ message: 'Supplier name is required' });
    }

    const result = await pool.query(
      `UPDATE suppliers
       SET name = $1, contact_person = $2, email = $3, phone = $4, address = $5, notes = $6
       WHERE id = $7 AND user_id = $8
       RETURNING *`,
      [name, contact_person || null, email || null, phone || null, address || null, notes || null, id, req.user.id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ message: 'Supplier not found' });
    }

    res.json(result.rows[0]);
  } catch (error) {
    console.error('Update supplier error:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

const deleteSupplier = async (req, res) => {
  try {
    const { id } = req.params;

    const result = await pool.query(
      'DELETE FROM suppliers WHERE id = $1 AND user_id = $2 RETURNING id',
      [id, req.user.id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ message: 'Supplier not found' });
    }

    res.json({ message: 'Supplier deleted successfully' });
  } catch (error) {
    console.error('Delete supplier error:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

module.exports = { getSuppliers, createSupplier, updateSupplier, deleteSupplier };

