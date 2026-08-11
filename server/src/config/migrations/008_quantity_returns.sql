-- Allow the same sale_item_id to appear in multiple return_items rows.
-- Partial returns (e.g. return 2 of 5 units) create a new row each time.
ALTER TABLE return_items DROP CONSTRAINT IF EXISTS return_items_sale_item_id_key;
