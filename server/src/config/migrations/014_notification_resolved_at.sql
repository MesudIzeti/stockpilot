-- Track when a low-stock / out-of-stock alert is resolved by a stock replenishment.
-- The cooldown in checkAndNotify now only blocks re-sending for *unresolved* alerts,
-- so a fresh notification fires whenever stock genuinely drops again after recovering.
ALTER TABLE notifications
  ADD COLUMN IF NOT EXISTS resolved_at TIMESTAMP;
