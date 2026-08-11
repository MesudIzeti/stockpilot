-- Add employee sub-user support.
-- Safe to run on existing databases — all statements are idempotent.

-- 1. Add owner_id so employee rows point back to the admin who created them.
ALTER TABLE users
  ADD COLUMN IF NOT EXISTS owner_id INTEGER REFERENCES users(id) ON DELETE CASCADE;

-- 2. Extend the role constraint to allow 'employee'.
--    PostgreSQL requires dropping and recreating the CHECK constraint.
ALTER TABLE users DROP CONSTRAINT IF EXISTS users_role_check;
ALTER TABLE users
  ADD CONSTRAINT users_role_check CHECK (role IN ('admin', 'user', 'employee'));
