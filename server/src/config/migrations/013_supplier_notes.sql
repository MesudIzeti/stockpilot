-- Add notes column to suppliers table.
-- The frontend already sends and displays this field; the backend was ignoring it.
ALTER TABLE suppliers
  ADD COLUMN IF NOT EXISTS notes TEXT;
