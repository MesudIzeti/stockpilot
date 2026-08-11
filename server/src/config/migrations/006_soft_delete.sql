-- Migration 006: Soft delete for products and categories (30-day restore window)

ALTER TABLE products   ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMP;
ALTER TABLE categories ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMP;

CREATE INDEX IF NOT EXISTS idx_products_deleted   ON products(user_id, deleted_at);
CREATE INDEX IF NOT EXISTS idx_categories_deleted ON categories(user_id, deleted_at);
