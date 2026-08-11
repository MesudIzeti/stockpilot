-- Migration 005: Purchase Order delivery reminder system

-- 1. Track whether a reminder email has been sent for each in-transit order
ALTER TABLE purchase_orders ADD COLUMN IF NOT EXISTS reminder_sent_at TIMESTAMP;

-- 2. Extend the notifications type check to include PO reminders
--    (PostgreSQL auto-names inline CHECK constraints as <table>_<column>_check)
ALTER TABLE notifications DROP CONSTRAINT IF EXISTS notifications_type_check;
ALTER TABLE notifications ADD CONSTRAINT notifications_type_check
  CHECK (type IN ('LOW_STOCK', 'OUT_OF_STOCK', 'EXPIRY_WARNING', 'PO_REMINDER'));
