-- Migration 003: Scope SKU and barcode uniqueness per user
-- Previously, sku and barcode had global UNIQUE constraints.
-- In a multi-tenant system each business has its own SKU namespace,
-- so uniqueness must be enforced per user_id, not globally.

ALTER TABLE products DROP CONSTRAINT IF EXISTS products_sku_key;
ALTER TABLE products DROP CONSTRAINT IF EXISTS products_barcode_key;

ALTER TABLE products
  ADD CONSTRAINT products_sku_user_unique UNIQUE (user_id, sku);

ALTER TABLE products
  ADD CONSTRAINT products_barcode_user_unique UNIQUE (user_id, barcode);
