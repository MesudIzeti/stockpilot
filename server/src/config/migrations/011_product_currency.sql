-- Add currency to products (default USD so existing products are unaffected)
ALTER TABLE products
  ADD COLUMN IF NOT EXISTS currency VARCHAR(3) NOT NULL DEFAULT 'USD';

-- Add currency + exchange_rate to sale_items
-- exchange_rate = units of this currency per 1 USD (from open.er-api.com)
-- e.g. EUR ≈ 0.876, MKD ≈ 54.83, USD = 1.0
ALTER TABLE sale_items
  ADD COLUMN IF NOT EXISTS currency      VARCHAR(3)     NOT NULL DEFAULT 'USD',
  ADD COLUMN IF NOT EXISTS exchange_rate NUMERIC(18, 6) NOT NULL DEFAULT 1.0;

-- Add currency + exchange_rate to return_items (inherited from original sale_item)
ALTER TABLE return_items
  ADD COLUMN IF NOT EXISTS currency      VARCHAR(3)     NOT NULL DEFAULT 'USD',
  ADD COLUMN IF NOT EXISTS exchange_rate NUMERIC(18, 6) NOT NULL DEFAULT 1.0;
