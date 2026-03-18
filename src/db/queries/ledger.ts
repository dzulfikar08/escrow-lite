/**
 * Database queries for the immutable ledger system
 */

/**
 * Get current balance for a seller from their latest ledger entry
 */
export const GET_SELLER_BALANCE = `
  SELECT balance_after
  FROM ledger_entries
  WHERE seller_id = ?
  ORDER BY created_at DESC
  LIMIT 1
`;

/**
 * Get held balance amount (sum of transactions in 'held' or 'disputed' status)
 */
export const GET_HELD_BALANCE = `
  SELECT COALESCE(SUM(amount), 0) as total
  FROM transactions
  WHERE seller_id = ? AND status IN ('held', 'disputed')
`;

/**
 * Get pending payouts total
 */
export const GET_PENDING_PAYOUTS = `
  SELECT COALESCE(SUM(amount), 0) as total
  FROM payouts
  WHERE seller_id = ? AND status IN ('pending', 'processing')
`;

/**
 * Insert a new ledger entry (append-only)
 */
export const INSERT_LEDGER_ENTRY = `
  INSERT INTO ledger_entries (
    id,
    seller_id,
    transaction_id,
    payout_id,
    type,
    amount,
    direction,
    balance_after,
    note,
    metadata,
    created_at
  ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'))
`;

/**
 * Get ledger history for a seller
 */
export const GET_SELLER_HISTORY = `
  SELECT
    id,
    seller_id,
    transaction_id,
    payout_id,
    type,
    amount,
    direction,
    balance_after,
    note,
    metadata,
    created_at
  FROM ledger_entries
  WHERE seller_id = ?
  ORDER BY created_at DESC
  LIMIT ?
`;

/**
 * Get ledger entries by transaction ID
 */
export const GET_TRANSACTION_ENTRIES = `
  SELECT
    id,
    seller_id,
    transaction_id,
    payout_id,
    type,
    amount,
    direction,
    balance_after,
    note,
    metadata,
    created_at
  FROM ledger_entries
  WHERE transaction_id = ?
  ORDER BY created_at ASC
`;

/**
 * Get ledger entries by payout ID
 */
export const GET_PAYOUT_ENTRIES = `
  SELECT
    id,
    seller_id,
    transaction_id,
    payout_id,
    type,
    amount,
    direction,
    balance_after,
    note,
    metadata,
    created_at
  FROM ledger_entries
  WHERE payout_id = ?
  ORDER BY created_at ASC
`;

/**
 * Get ledger entry by ID
 */
export const GET_LEDGER_ENTRY = `
  SELECT
    id,
    seller_id,
    transaction_id,
    payout_id,
    type,
    amount,
    direction,
    balance_after,
    note,
    metadata,
    created_at
  FROM ledger_entries
  WHERE id = ?
`;

/**
 * Get all ledger entries for audit purposes
 */
export const GET_ALL_LEDGER_ENTRIES = `
  SELECT
    id,
    seller_id,
    transaction_id,
    payout_id,
    type,
    amount,
    direction,
    balance_after,
    note,
    metadata,
    created_at
  FROM ledger_entries
  ORDER BY created_at ASC
`;
