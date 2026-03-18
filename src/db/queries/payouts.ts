/**
 * Database queries for payout operations
 */

/**
 * Get all payouts for a seller
 */
export const GET_SELLER_PAYOUTS = `
  SELECT
    p.id,
    p.seller_id,
    p.amount,
    p.fee_amount,
    p.net_amount,
    p.status,
    ba.bank_code,
    ba.account_number,
    ba.account_name,
    p.disbursement_ref,
    p.failed_reason,
    p.requested_at,
    p.processing_at,
    p.completed_at,
    p.metadata,
    p.created_at,
    p.updated_at
  FROM payouts p
  JOIN seller_bank_accounts ba ON p.bank_account_id = ba.id
  WHERE p.seller_id = ?
  ORDER BY p.requested_at DESC
`;

/**
 * Get a single payout by ID
 */
export const GET_PAYOUT_BY_ID = `
  SELECT
    p.id,
    p.seller_id,
    p.amount,
    p.fee_amount,
    p.net_amount,
    p.status,
    p.bank_account_id,
    ba.bank_code,
    ba.account_number,
    ba.account_name,
    p.disbursement_ref,
    p.failed_reason,
    p.requested_at,
    p.processing_at,
    p.completed_at,
    p.metadata,
    p.created_at,
    p.updated_at
  FROM payouts p
  JOIN seller_bank_accounts ba ON p.bank_account_id = ba.id
  WHERE p.id = ?
`;

/**
 * Get bank account by ID
 */
export const GET_BANK_ACCOUNT = `
  SELECT
    id,
    seller_id,
    bank_code,
    account_number,
    account_name,
    is_primary,
    verified_at,
    created_at,
    updated_at
  FROM seller_bank_accounts
  WHERE id = ?
`;

/**
 * Create a new payout
 */
export const CREATE_PAYOUT = `
  INSERT INTO payouts (
    id,
    seller_id,
    amount,
    fee_amount,
    net_amount,
    bank_account_id,
    status,
    requested_at,
    metadata,
    created_at,
    updated_at
  ) VALUES (?, ?, ?, ?, ?, ?, 'pending', datetime('now'), ?, datetime('now'), datetime('now'))
`;

/**
 * Update payout status
 */
export const UPDATE_PAYOUT_STATUS = `
  UPDATE payouts
  SET
    status = ?,
    processing_at = CASE
      WHEN ? = 'processing' THEN datetime('now')
      ELSE processing_at
    END,
    completed_at = CASE
      WHEN ? = 'completed' THEN datetime('now')
      ELSE completed_at
    END,
    failed_reason = CASE
      WHEN ? = 'failed' THEN ?
      ELSE NULL
    END,
    disbursement_ref = CASE
      WHEN ? IS NOT NULL THEN ?
      ELSE disbursement_ref
    END,
    updated_at = datetime('now')
  WHERE id = ?
`;

/**
 * Get pending payouts (for batch processing)
 */
export const GET_PENDING_PAYOUTS = `
  SELECT
    p.id,
    p.seller_id,
    p.amount,
    p.fee_amount,
    p.net_amount,
    p.bank_account_id,
    ba.bank_code,
    ba.account_number,
    ba.account_name,
    p.status,
    p.metadata
  FROM payouts p
  JOIN seller_bank_accounts ba ON p.bank_account_id = ba.id
  WHERE p.status = 'pending'
  ORDER BY p.requested_at ASC
  LIMIT 50
`;

/**
 * Check if payout exists
 */
export const PAYOUT_EXISTS = `
  SELECT 1 as exists
  FROM payouts
  WHERE id = ?
`;
