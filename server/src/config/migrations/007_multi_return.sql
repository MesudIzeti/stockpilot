-- Allow multiple return transactions per sale.
-- Each individual sale_item_id can only appear once across all returns (already enforced).
ALTER TABLE returns DROP CONSTRAINT IF EXISTS returns_sale_id_key;
