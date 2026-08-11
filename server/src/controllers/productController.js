const pool = require('../config/db');
const multer = require('multer');
const { checkAndNotify } = require('../services/notificationService');

const {parse} = require('csv-parse/sync');

const upload = multer({storage: multer.memoryStorage(),
    fileFilter: (req, file, cb) => {
        if (file.mimetype === 'text/csv' || file.originalname.endsWith('.csv')) {
            cb(null, true);
        } else {
            cb(new Error('Only CSV files are allowed!'), false);
        }
    }
});

// PostgreSQL's pg driver returns DECIMAL/NUMERIC columns as strings. Cast them to JS numbers
// here so every consumer gets the correct types and comparisons work correctly.
const VALID_CURRENCIES = new Set([
  'USD','EUR','GBP','CHF','MKD','JPY','CAD','AUD','TRY',
  'CNY','INR','BRL','MXN','SGD','HKD','NOK','SEK','DKK','PLN','CZK',
]);

function normalizeCurrency(code) {
  const upper = (code || 'USD').trim().toUpperCase();
  return VALID_CURRENCIES.has(upper) ? upper : 'USD';
}

function normalizeProduct(row) {
  return {
    ...row,
    price:           row.price           != null ? parseFloat(row.price)           : null,
    cost_price:      row.cost_price      != null ? parseFloat(row.cost_price)      : null,
    quantity:        row.quantity        != null ? parseFloat(row.quantity)        : 0,
    min_stock_level: row.min_stock_level != null ? parseFloat(row.min_stock_level) : 0,
    currency:        row.currency        || 'USD',
  };
}

//GET /api/products
const getProducts = async (req, res ) => {
    try {
        const {search, category_id , low_stock} = req.query;

       
    let query = `
      SELECT p.id, p.name, p.description, p.sku, p.barcode,
             p.price, p.cost_price, p.quantity, p.unit, p.currency,
             p.min_stock_level, p.expiry_date, p.created_at, p.updated_at,
             c.id AS category_id, c.name AS category_name,
             s.id AS supplier_id, s.name AS supplier_name, s.phone AS supplier_phone
      FROM products p
      JOIN categories c ON p.category_id = c.id
      LEFT JOIN suppliers s ON p.supplier_id = s.id
        WHERE p.user_id = $1
        `;
        const params = [req.user.id];
        let paramCount = 1;

        if (search) {
            paramCount++;
            query += ` AND (p.name ILIKE $${paramCount} OR p.sku ILIKE $${paramCount} OR p.barcode ILIKE $${paramCount})`;
            params.push(`%${search}%`);
        }
        if (category_id) {
            paramCount++;
            query += ` AND p.category_id = $${paramCount}`;
            params.push(category_id);
        }
        if (low_stock === 'true'){
            query += ` AND p.quantity <= p.min_stock_level`;
        }
        // deleted_at filter appended after the if-blocks above

        query += ` AND p.deleted_at IS NULL`;
        query += ` ORDER BY p.name ASC`;

        const result = await pool.query(query, params);
        res.json(result.rows.map(normalizeProduct));
    } catch (error){
        console.error('Get products error:', error);
        res.status(500).json({message: 'Server error'});
    }
};

//Get /api/products/:id
const getProduct = async (req, res) => {
    try {
        const {id} = req.params;

        const result = await pool.query(
            `SELECT p.id, p.name, p.description, p.sku, p.barcode,
              p.price, p.cost_price, p.quantity, p.unit, p.currency,
              p.min_stock_level, p.expiry_date, p.created_at, p.updated_at,
              c.id AS category_id, c.name AS category_name,
              s.id AS supplier_id, s.name AS supplier_name, s.phone AS supplier_phone
       FROM products p
       JOIN categories c ON p.category_id = c.id
       LEFT JOIN suppliers s ON p.supplier_id = s.id
       WHERE p.id = $1 AND p.user_id = $2 AND p.deleted_at IS NULL`,
      [id, req.user.id]

        );
    if (result.rows.length === 0) {
        return res.status(404).json({message: 'Product not found'});
    }
    res.json(normalizeProduct(result.rows[0]));
    
    } catch (error) {
        console.error('Get product by ID error:', error);
        res.status(500).json({message: 'Server error'});
    }
};

//POST /api/products
const createProduct = async (req, res) => {
    try{
        const{name, description, sku, barcode,
      price, cost_price, quantity,
      unit, min_stock_level, expiry_date,
      category_id, supplier_id, currency} = req.body;
      
      if (!name || !price || !category_id) {
        return res.status(400).json({ message: 'Name, price, and category are required' });
      }
      if (parseFloat(price) <= 0) {
        return res.status(400).json({ message: 'Selling price must be greater than 0' });
      }
      if (!quantity || parseFloat(quantity) < 1) {
        return res.status(400).json({ message: 'Quantity must be at least 1 when adding a new product' });
      }
      if (cost_price !== null && cost_price !== undefined && cost_price !== '') {
        const cp = parseFloat(cost_price);
        const sp = parseFloat(price);
        if (cp <= 0) return res.status(400).json({ message: 'Cost price must be greater than 0' });
        if (cp >= sp)  return res.status(400).json({ message: 'Cost price must be lower than the selling price' });
      }
      const client = await pool.connect();
        try {
            await client.query('BEGIN');
            
            const result = await client.query(
                `INSERT INTO products
          (name, description, sku, barcode, price, cost_price, quantity, unit, min_stock_level, expiry_date, category_id, supplier_id, user_id, created_by, currency)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15)
         RETURNING *`,
        [
          name,
          description || null,
          sku || null,
          barcode || null,
          price,
          cost_price || null,
          quantity || 0,
          unit || 'piece',
          min_stock_level || 0,
          expiry_date || null,
          category_id,
          supplier_id || null,
          req.user.id,
          req.user.actualUserId,
          normalizeCurrency(currency),
        ]
      );

      const product = result.rows[0];

      if (parseFloat(quantity)> 0) {
         await client.query(
          `INSERT INTO stock_movements (product_id, type, quantity, reason, user_id)
           VALUES ($1, 'IN', $2, 'Initial stock', $3)`,
          [product.id, quantity, req.user.actualUserId]
        );
      }

        await client.query('COMMIT');
        res.status(201).json(normalizeProduct(product));
         } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }
  } catch (error) {
    console.error('Create product error:', error);
    if (error.code === '23505') {
      return res.status(409).json({ message: 'A product with this SKU or barcode already exists' });
    }
    res.status(500).json({ message: 'Server error' });
  }
};

// PUT /api/products/:id
const updateProduct = async (req, res) => {
  try {
    const { id } = req.params;
    const {
      name, description, sku, barcode,
      price, cost_price, quantity,
      unit, min_stock_level, expiry_date,
      category_id, supplier_id, currency
    } = req.body;

    if (!name || !price || !category_id) {
      return res.status(400).json({ message: 'Name, price, and category are required' });
    }
    if (parseFloat(price) <= 0) {
      return res.status(400).json({ message: 'Selling price must be greater than 0' });
    }
    if (cost_price !== null && cost_price !== undefined && cost_price !== '') {
      const cp = parseFloat(cost_price);
      const sp = parseFloat(price);
      if (cp <= 0) return res.status(400).json({ message: 'Cost price must be greater than 0' });
      if (cp >= sp)  return res.status(400).json({ message: 'Cost price must be lower than the selling price' });
    }

    const current = await pool.query(
      'SELECT quantity FROM products WHERE id = $1 AND user_id = $2 AND deleted_at IS NULL',
      [id, req.user.id]
    );

    if (current.rows.length === 0) {
      return res.status(404).json({ message: 'Product not found' });
    }

    const client = await pool.connect();
    try {
      await client.query('BEGIN');

      const result = await client.query(
        `UPDATE products
         SET name=$1, description=$2, sku=$3, barcode=$4, price=$5, cost_price=$6,
             quantity=$7, unit=$8, min_stock_level=$9, expiry_date=$10,
             category_id=$11, supplier_id=$12, currency=$13, updated_at=CURRENT_TIMESTAMP
         WHERE id=$14 AND user_id=$15
         RETURNING *`,
        [
          name,
          description || null,
          sku || null,
          barcode || null,
          price,
          cost_price || null,
          quantity ?? current.rows[0].quantity,
          unit || 'piece',
          min_stock_level || 0,
          expiry_date || null,
          category_id,
          supplier_id || null,
          normalizeCurrency(currency),
          id,
          req.user.id
        ]
      );

      const oldQty = parseFloat(current.rows[0].quantity);
      const newQty = parseFloat(quantity);

      if(!isNaN(newQty) && newQty !== oldQty) {
        await client.query(
            `INSERT INTO stock_movements (product_id, type, quantity, reason, user_id)
           VALUES ($1, 'ADJUSTMENT', $2, $3, $4)`,
          [id, Math.abs(newQty - oldQty), `Manual adjustment: ${oldQty} → ${newQty}`, req.user.actualUserId]
        );
      }
      await client.query('COMMIT');
      res.json(normalizeProduct(result.rows[0]));

      // Fire-and-forget — resolves open alerts when stock is replenished via edit,
      // or fires a new alert if quantity was reduced below the threshold.
      if (!isNaN(newQty)) {
        checkAndNotify(req.user.id, parseInt(id), newQty);
      }
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }
  } catch (error) {
    console.error('Update product error:', error);
    if (error.code === '23505') {
      return res.status(409).json({ message: 'A product with this SKU or barcode already exists' });
    }
    res.status(500).json({ message: 'Server error' });
  }
};

// DELETE /api/products/:id  — soft delete (30-day restore window)
const deleteProduct = async (req, res) => {
  try {
    const { id } = req.params;

    const result = await pool.query(
      `UPDATE products
       SET deleted_at = NOW(), updated_at = CURRENT_TIMESTAMP
       WHERE id = $1 AND user_id = $2 AND deleted_at IS NULL
       RETURNING id, name`,
      [id, req.user.id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ message: 'Product not found' });
    }

    res.json({
      message: `"${result.rows[0].name}" moved to trash. You have 30 days to restore it.`,
    });
  } catch (error) {
    console.error('Delete product error:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

// GET /api/products/deleted
const getDeletedProducts = async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT p.id, p.name, p.sku, p.quantity, p.unit, p.price, p.deleted_at,
              c.name AS category_name
       FROM products p
       LEFT JOIN categories c ON c.id = p.category_id
       WHERE p.user_id = $1
         AND p.deleted_at IS NOT NULL
         AND p.deleted_at > NOW() - INTERVAL '30 days'
       ORDER BY p.deleted_at DESC`,
      [req.user.id]
    );
    res.json(result.rows);
  } catch (error) {
    console.error('Get deleted products error:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

// PUT /api/products/:id/restore
const restoreProduct = async (req, res) => {
  const { id } = req.params;
  const { stock_count } = req.body;

  if (stock_count === undefined || stock_count === null || isNaN(Number(stock_count)) || Number(stock_count) < 0) {
    return res.status(400).json({ message: 'A valid current stock count (0 or more) is required to restore a product.' });
  }
  const newQty = Math.floor(Number(stock_count));

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const result = await client.query(
      `UPDATE products
       SET deleted_at = NULL, quantity = $3, updated_at = CURRENT_TIMESTAMP
       WHERE id = $1 AND user_id = $2
         AND deleted_at IS NOT NULL
         AND deleted_at > NOW() - INTERVAL '30 days'
       RETURNING id, name`,
      [id, req.user.id, newQty]
    );

    if (result.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({ message: 'Product not found, already restored, or restore window expired' });
    }

    const { name } = result.rows[0];

    if (newQty > 0) {
      await client.query(
        `INSERT INTO stock_movements (product_id, type, quantity, reason, user_id)
         VALUES ($1, 'ADJUSTMENT', $2, 'Restored from trash', $3)`,
        [id, newQty, req.user.id]
      );
    }

    await client.query('COMMIT');
    res.json({ message: `"${name}" restored with ${newQty} unit${newQty !== 1 ? 's' : ''} in stock.` });
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Restore product error:', error);
    res.status(500).json({ message: 'Server error' });
  } finally {
    client.release();
  }
};

// POST /api/products/batch
const batchCreateProducts = async (req, res) => {
  try {
    const { products, category_id } = req.body;

    if (!products || !Array.isArray(products) || products.length === 0) {
      return res.status(400).json({ message: 'Products array is required' });
    }

    if (!category_id) {
      return res.status(400).json({ message: 'Category is required' });
    }

    const client = await pool.connect();
    try {
      await client.query('BEGIN');

      const created = [];
      for (const p of products) {
        if (!p.name || !p.price) continue;
        const sp = parseFloat(p.price);
        if (isNaN(sp) || sp <= 0) continue;
        if (p.cost_price !== null && p.cost_price !== undefined && p.cost_price !== '') {
          const cp = parseFloat(p.cost_price);
          if (isNaN(cp) || cp <= 0 || cp >= sp) p.cost_price = null;
        }

        const result = await client.query(
          `INSERT INTO products
            (name, price, cost_price, quantity, unit, min_stock_level, category_id, user_id, created_by, currency)
           VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)
           RETURNING id, name, price, quantity, unit, currency`,
          [
            p.name,
            p.price,
            p.cost_price || null,
            p.quantity || 0,
            p.unit || 'piece',
            p.min_stock_level || 0,
            category_id,
            req.user.id,
            req.user.actualUserId,
            normalizeCurrency(p.currency),
          ]
        );

        created.push(result.rows[0]);

        if (parseFloat(p.quantity) > 0) {
          await client.query(
            `INSERT INTO stock_movements (product_id, type, quantity, reason, user_id)
             VALUES ($1, 'IN', $2, 'Initial stock (batch)', $3)`,
            [result.rows[0].id, p.quantity, req.user.actualUserId]
          );
        }
      }

      await client.query('COMMIT');
      res.status(201).json({
        message: `${created.length} products created successfully`,
        count: created.length,
        products: created
      });
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }
  } catch (error) {
    console.error('Batch create error:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

// POST /api/products/import
const importProducts = async (req, res) => {
  if (!req.file) {
    return res.status(400).json({ message: 'No file uploaded' });
  }

  try {
    const records = parse(req.file.buffer.toString(), {
      columns: true,
      skip_empty_lines: true,
      trim: true,
    });

    const results = { imported: 0, restocked: 0, errors: [] };

    for (let i = 0; i < records.length; i++) {
      const row = records[i];
      const rowNum = i + 2;

      try {
        if (!row.name || !row.price || !row.category) {
          results.errors.push({
            row: rowNum,
            name: row.name || '—',
            error: 'Missing required fields: name, price, category'
          });
          continue;
        }

        // Resolve or create category
        let catResult = await pool.query(
          'SELECT id FROM categories WHERE name = $1 AND user_id = $2',
          [row.category.trim(), req.user.id]
        );

        let categoryId;
        if (catResult.rows.length === 0) {
          const newCat = await pool.query(
            'INSERT INTO categories (name, user_id) VALUES ($1, $2) RETURNING id',
            [row.category.trim(), req.user.id]
          );
          categoryId = newCat.rows[0].id;
        } else {
          categoryId = catResult.rows[0].id;
        }

        const quantity = parseFloat(row.quantity || 0);
        const sku     = row.sku?.trim()     || null;
        const barcode = row.barcode?.trim() || null;

        // Check if this product already exists for this user (restock scenario)
        let existingProduct = null;
        if (sku) {
          const found = await pool.query(
            'SELECT id FROM products WHERE user_id = $1 AND sku = $2 AND deleted_at IS NULL',
            [req.user.id, sku]
          );
          if (found.rows.length > 0) existingProduct = found.rows[0];
        }
        if (!existingProduct && barcode) {
          const found = await pool.query(
            'SELECT id FROM products WHERE user_id = $1 AND barcode = $2 AND deleted_at IS NULL',
            [req.user.id, barcode]
          );
          if (found.rows.length > 0) existingProduct = found.rows[0];
        }

        if (existingProduct) {
          // Product exists — add incoming stock instead of failing
          await pool.query(
            `UPDATE products
             SET quantity = quantity + $1, updated_at = CURRENT_TIMESTAMP
             WHERE id = $2`,
            [quantity, existingProduct.id]
          );
          if (quantity > 0) {
            await pool.query(
              `INSERT INTO stock_movements (product_id, type, quantity, reason, user_id)
               VALUES ($1, 'IN', $2, 'Restock (CSV import)', $3)`,
              [existingProduct.id, quantity, req.user.actualUserId]
            );
          }
          results.restocked++;
        } else {
          // New product — create it
          const productResult = await pool.query(
            `INSERT INTO products
              (name, sku, barcode, price, cost_price, quantity, unit, min_stock_level, expiry_date, category_id, user_id, created_by, currency)
             VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13)
             RETURNING id`,
            [
              row.name.trim(),
              sku,
              barcode,
              parseFloat(row.price),
              row.cost_price ? parseFloat(row.cost_price) : null,
              quantity,
              row.unit?.trim() || 'piece',
              parseFloat(row.min_stock_level || 0),
              row.expiry_date?.trim() || null,
              categoryId,
              req.user.id,
              req.user.actualUserId,
              normalizeCurrency(row.currency),
            ]
          );
          if (quantity > 0) {
            await pool.query(
              `INSERT INTO stock_movements (product_id, type, quantity, reason, user_id)
               VALUES ($1, 'IN', $2, 'Initial stock (CSV import)', $3)`,
              [productResult.rows[0].id, quantity, req.user.actualUserId]
            );
          }
          results.imported++;
        }
      } catch (err) {
        results.errors.push({
          row: rowNum,
          name: row.name || '—',
          error: err.code === '23505' ? 'Duplicate SKU or barcode' : err.message
        });
      }
    }

    const parts = [];
    if (results.imported  > 0) parts.push(`${results.imported} new products created`);
    if (results.restocked > 0) parts.push(`${results.restocked} products restocked`);
    if (results.errors.length > 0) parts.push(`${results.errors.length} errors`);

    res.json({
      message: parts.length ? `Import complete: ${parts.join(', ')}` : 'Nothing to import',
      ...results
    });
  } catch (error) {
    console.error('Import error:', error);
    res.status(400).json({ message: 'Failed to parse CSV file. Check the file format.' });
  }
};

module.exports = {
  upload,
  getProducts,
  getProduct,
  createProduct,
  updateProduct,
  deleteProduct,
  getDeletedProducts,
  restoreProduct,
  batchCreateProducts,
  importProducts
};