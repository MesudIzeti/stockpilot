-- Email verification table: stores pending registrations until OTP is confirmed
CREATE TABLE IF NOT EXISTS email_verifications (
  id            SERIAL       PRIMARY KEY,
  email         VARCHAR(255) NOT NULL,
  name          VARCHAR(255) NOT NULL,
  password_hash TEXT         NOT NULL,
  code          VARCHAR(6)   NOT NULL,
  expires_at    TIMESTAMP    NOT NULL,
  created_at    TIMESTAMP    DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_email_verifications_email
  ON email_verifications (email);
