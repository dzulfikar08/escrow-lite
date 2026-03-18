/**
 * Migration: Add Payout Retry Tracking
 *
 * Adds retry tracking columns to the payouts table to support
 * automated payout processing with exponential backoff retry logic.
 *
 * Columns added:
 * - retry_count: Number of retry attempts
 * - last_processed_at: Last time the payout was processed
 * - next_retry_at: When the payout should be retried (NULL if max retries reached)
 */

import type { Migration } from './index.js';

export const migration: Migration = {
  version: 2,
  name: 'add_payout_retry_tracking',
  up: `
    -- Add retry_count column
    ALTER TABLE payouts ADD COLUMN retry_count INTEGER DEFAULT 0;

    -- Add last_processed_at column
    ALTER TABLE payouts ADD COLUMN last_processed_at TEXT;

    -- Add next_retry_at column
    ALTER TABLE payouts ADD COLUMN next_retry_at TEXT;

    -- Create index on next_retry_at for efficient retry queries
    CREATE INDEX IF NOT EXISTS idx_payouts_next_retry_at ON payouts(next_retry_at);

    -- Create index on last_processed_at for idempotency checks
    CREATE INDEX IF NOT EXISTS idx_payouts_last_processed_at ON payouts(last_processed_at);
  `,
  down: `
    -- Rollback: Remove the columns and indexes
    DROP INDEX IF EXISTS idx_payouts_last_processed_at;
    DROP INDEX IF EXISTS idx_payouts_next_retry_at;

    -- SQLite doesn't support DROP COLUMN directly
    -- In production, you would need to recreate the table without these columns
  `,
};
