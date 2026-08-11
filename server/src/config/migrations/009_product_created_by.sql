-- Track which employee added a product to the system
ALTER TABLE products ADD COLUMN IF NOT EXISTS created_by INTEGER REFERENCES users(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS idx_products_created_by ON products(created_by);
