/**
 * Better Auth Tables Migration
 *
 * Better-auth requires specific tables for authentication:
 * - user: User accounts
 * - session: User sessions
 * - account: OAuth accounts (optional, for future use)
 * - verification: Email verification tokens (optional)
 */

export const betterAuthTablesMigration = {
  version: 3,
  name: 'better_auth_tables',
  up: `
-- Better Auth User Table
-- This will be the primary users table (replacing the sellers table concept for auth)
CREATE TABLE IF NOT EXISTS user (
  id TEXT PRIMARY KEY,
  email TEXT NOT NULL UNIQUE,
  emailVerified INTEGER DEFAULT 0,
  name TEXT,
  image TEXT,
  createdAt TEXT NOT NULL DEFAULT (datetime('now')),
  updatedAt TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Better Auth Session Table
CREATE TABLE IF NOT EXISTS session (
  id TEXT PRIMARY KEY,
  userId TEXT NOT NULL,
  expiresAt TEXT NOT NULL,
  token TEXT NOT NULL UNIQUE,
  ipAddress TEXT,
  userAgent TEXT,
  createdAt TEXT NOT NULL DEFAULT (datetime('now')),
  updatedAt TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY (userId) REFERENCES user(id) ON DELETE CASCADE
);

-- Better Auth Account Table (for OAuth providers - optional but good for future)
CREATE TABLE IF NOT EXISTS account (
  id TEXT PRIMARY KEY,
  userId TEXT NOT NULL,
  accountId TEXT NOT NULL,
  providerId TEXT NOT NULL,
  accessToken TEXT,
  refreshToken TEXT,
  idToken TEXT,
  expiresAt TEXT,
  password TEXT,
  createdAt TEXT NOT NULL DEFAULT (datetime('now')),
  updatedAt TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE(providerId, accountId),
  FOREIGN KEY (userId) REFERENCES user(id) ON DELETE CASCADE
);

-- Better Auth Verification Table (for email verification - optional)
CREATE TABLE IF NOT EXISTS verification (
  id TEXT PRIMARY KEY,
  identifier TEXT NOT NULL,
  value TEXT NOT NULL,
  expiresAt TEXT NOT NULL,
  createdAt TEXT NOT NULL DEFAULT (datetime('now')),
  updatedAt TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Indexes for better-auth tables
CREATE INDEX IF NOT EXISTS idx_user_email ON user(email);
CREATE INDEX IF NOT EXISTS idx_session_userId ON session(userId);
CREATE INDEX IF NOT EXISTS idx_session_token ON session(token);
CREATE INDEX IF NOT EXISTS idx_session_expiresAt ON session(expiresAt);
CREATE INDEX IF NOT EXISTS idx_account_userId ON account(userId);
CREATE INDEX IF NOT EXISTS idx_account_providerId ON account(providerId);
CREATE INDEX IF NOT EXISTS idx_verification_identifier ON verification(identifier);
CREATE INDEX IF NOT EXISTS idx_verification_expiresAt ON verification(expiresAt);

-- Trigger to update user updatedAt
CREATE TRIGGER IF NOT EXISTS update_user_updatedAt
  AFTER UPDATE ON user
  FOR EACH ROW
  BEGIN
    UPDATE user SET updatedAt = datetime('now') WHERE id = NEW.id;
  END;

-- Trigger to update session updatedAt
CREATE TRIGGER IF NOT EXISTS update_session_updatedAt
  AFTER UPDATE ON session
  FOR EACH ROW
  BEGIN
    UPDATE session SET updatedAt = datetime('now') WHERE id = NEW.id;
  END;

-- Trigger to update account updatedAt
CREATE TRIGGER IF NOT EXISTS update_account_updatedAt
  AFTER UPDATE ON account
  FOR EACH ROW
  BEGIN
    UPDATE account SET updatedAt = datetime('now') WHERE id = NEW.id;
  END;

-- Trigger to update verification updatedAt
CREATE TRIGGER IF NOT EXISTS update_verification_updatedAt
  AFTER UPDATE ON verification
  FOR EACH ROW
  BEGIN
    UPDATE verification SET updatedAt = datetime('now') WHERE id = NEW.id;
  END;
`,
  down: `
-- Rollback better-auth tables
DROP INDEX IF EXISTS idx_verification_expiresAt;
DROP INDEX IF EXISTS idx_verification_identifier;
DROP INDEX IF EXISTS idx_account_providerId;
DROP INDEX IF EXISTS idx_account_userId;
DROP INDEX IF EXISTS idx_session_expiresAt;
DROP INDEX IF EXISTS idx_session_token;
DROP INDEX IF EXISTS idx_session_userId;
DROP INDEX IF EXISTS idx_user_email;

DROP TRIGGER IF EXISTS update_verification_updatedAt;
DROP TRIGGER IF EXISTS update_account_updatedAt;
DROP TRIGGER IF EXISTS update_session_updatedAt;
DROP TRIGGER IF EXISTS update_user_updatedAt;

DROP TABLE IF EXISTS verification;
DROP TABLE IF EXISTS account;
DROP TABLE IF EXISTS session;
DROP TABLE IF EXISTS user;
`
};
