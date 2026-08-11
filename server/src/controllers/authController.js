const pool = require('../config/db');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const { sendVerificationEmail } = require('../services/emailService');

// In-memory OTP attempt tracker — auto-clears when the OTP window expires or code is verified
const otpAttempts = new Map();
const OTP_MAX_ATTEMPTS = 5;
const OTP_WINDOW_MS = 10 * 60 * 1000;

// ── Register: send OTP, do NOT create user yet ────────────────────────────────

const register = async (req, res) => {
  try {
    const { name, email, password } = req.body;

    if (!name || !email || !password) {
      return res.status(400).json({ message: 'All fields are required' });
    }

    const existingUser = await pool.query('SELECT id FROM users WHERE email = $1', [email]);
    if (existingUser.rows.length > 0) {
      return res.status(409).json({ message: 'An account with this email already exists' });
    }

    const code = Math.floor(100000 + Math.random() * 900000).toString();
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000);

    const salt = await bcrypt.genSalt(10);
    const passwordHash = await bcrypt.hash(password, salt);

    await pool.query(`
      INSERT INTO email_verifications (email, name, password_hash, code, expires_at)
      VALUES ($1, $2, $3, $4, $5)
      ON CONFLICT (email) DO UPDATE SET
        name          = EXCLUDED.name,
        password_hash = EXCLUDED.password_hash,
        code          = EXCLUDED.code,
        expires_at    = EXCLUDED.expires_at,
        created_at    = NOW()
    `, [email, name, passwordHash, code, expiresAt]);

    await sendVerificationEmail({ toEmail: email, name, code });

    res.status(200).json({ message: 'Verification code sent', email });
  } catch (error) {
    console.error('Register error:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

// ── Verify OTP: confirm code, create user, return token ───────────────────────

const verifyEmail = async (req, res) => {
  try {
    const { email, code } = req.body;

    if (!email || !code) {
      return res.status(400).json({ message: 'Email and code are required' });
    }

    const result = await pool.query(
      'SELECT * FROM email_verifications WHERE email = $1',
      [email]
    );

    if (result.rows.length === 0) {
      return res.status(400).json({ message: 'No pending verification found. Please register again.' });
    }

    const pending = result.rows[0];

    if (new Date() > new Date(pending.expires_at)) {
      await pool.query('DELETE FROM email_verifications WHERE email = $1', [email]);
      return res.status(400).json({ message: 'Verification code has expired. Please register again.' });
    }

    const now = Date.now();
    let entry = otpAttempts.get(email) ?? { count: 0, resetAt: now + OTP_WINDOW_MS };

    // Expire the attempt window if the OTP itself has rolled over via re-registration
    if (now > entry.resetAt) {
      entry = { count: 0, resetAt: now + OTP_WINDOW_MS };
    }

    if (entry.count >= OTP_MAX_ATTEMPTS) {
      await pool.query('DELETE FROM email_verifications WHERE email = $1', [email]);
      otpAttempts.delete(email);
      return res.status(429).json({ message: 'Too many incorrect attempts. Please register again.' });
    }

    if (pending.code !== code.trim()) {
      entry.count++;
      otpAttempts.set(email, entry);
      const remaining = OTP_MAX_ATTEMPTS - entry.count;
      const msg = remaining > 0
        ? `Incorrect verification code. ${remaining} attempt${remaining !== 1 ? 's' : ''} remaining.`
        : 'Too many incorrect attempts. Please register again.';
      if (remaining === 0) {
        await pool.query('DELETE FROM email_verifications WHERE email = $1', [email]);
        otpAttempts.delete(email);
        return res.status(429).json({ message: msg });
      }
      return res.status(400).json({ message: msg });
    }

    otpAttempts.delete(email);

    const userResult = await pool.query(
      'INSERT INTO users (name, email, password, role) VALUES ($1, $2, $3, $4) RETURNING id, name, email, role, created_at',
      [pending.name, pending.email, pending.password_hash, 'admin']
    );
    const user = userResult.rows[0];

    await pool.query('DELETE FROM email_verifications WHERE email = $1', [email]);

    const token = jwt.sign(
      { id: user.id, email: user.email, role: user.role },
      process.env.JWT_SECRET,
      { expiresIn: '24h' }
    );

    res.status(201).json({ message: 'Account created successfully', user, token });
  } catch (error) {
    console.error('Verify email error:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

// ── Login ─────────────────────────────────────────────────────────────────────

const login = async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ message: 'Email and password are required' });
    }

    const result = await pool.query('SELECT * FROM users WHERE email = $1', [email]);

    if (result.rows.length === 0) {
      return res.status(401).json({ message: 'Invalid email or password' });
    }

    const user = result.rows[0];
    const isValidPassword = await bcrypt.compare(password, user.password);

    if (!isValidPassword) {
      return res.status(401).json({ message: 'Invalid email or password' });
    }

    const token = jwt.sign(
      { id: user.id, email: user.email, role: user.role, owner_id: user.owner_id ?? null },
      process.env.JWT_SECRET,
      { expiresIn: '24h' }
    );

    res.json({
      message: 'Login successful',
      user: { id: user.id, name: user.name, email: user.email, role: user.role },
      token,
    });
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

module.exports = { register, verifyEmail, login };
