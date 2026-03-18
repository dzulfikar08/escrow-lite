/**
 * Database queries for seller data and balance information
 */

/**
 * Get transaction history for a seller with pagination and filters
 */
export const GET_SELLER_TRANSACTIONS = `
  SELECT
    id,
    buyer_email,
    buyer_phone,
    amount,
    fee_rate,
    fee_amount,
    net_amount,
    status,
    gateway,
    gateway_transaction_id as gateway_ref,
    auto_release_days,
    auto_release_at,
    absolute_expire_at,
    shipped_at,
    release_reason,
    refunded_at,
    refund_reason,
    metadata,
    last_checked_at,
    created_at,
    updated_at,
    released_at
  FROM transactions
  WHERE seller_id = ?
  /*CONDITIONAL*/
  ORDER BY created_at DESC
  LIMIT ? OFFSET ?
`;

/**
 * Count transactions for a seller with optional status filter
 */
export const COUNT_SELLER_TRANSACTIONS = `
  SELECT COUNT(*) as count
  FROM transactions
  WHERE seller_id = ?
  /*CONDITIONAL*/
`;

/**
 * Search transactions by ID or buyer email
 */
export const SEARCH_SELLER_TRANSACTIONS = `
  SELECT
    id,
    buyer_email,
    buyer_phone,
    amount,
    fee_rate,
    fee_amount,
    net_amount,
    status,
    gateway,
    gateway_transaction_id as gateway_ref,
    auto_release_days,
    auto_release_at,
    absolute_expire_at,
    shipped_at,
    release_reason,
    refunded_at,
    refund_reason,
    metadata,
    last_checked_at,
    created_at,
    updated_at,
    released_at
  FROM transactions
  WHERE seller_id = ?
    AND (id LIKE ? OR buyer_email LIKE ?)
  /*STATUS_CONDITIONAL*/
  ORDER BY created_at DESC
  LIMIT ? OFFSET ?
`;

/**
 * Count search results
 */
export const COUNT_SEARCH_RESULTS = `
  SELECT COUNT(*) as count
  FROM transactions
  WHERE seller_id = ?
    AND (id LIKE ? OR buyer_email LIKE ?)
  /*STATUS_CONDITIONAL*/
`;

/**
 * Get payout history for a seller
 */
export const GET_SELLER_PAYOUTS = `
  SELECT
    p.id,
    p.amount,
    p.fee_amount,
    p.net_amount,
    p.status,
    p.bank_code,
    p.account_number,
    p.account_name,
    p.disbursement_ref,
    p.failed_reason,
    p.requested_at,
    p.processing_at,
    p.completed_at,
    p.created_at,
    p.updated_at
  FROM payouts p
  JOIN seller_bank_accounts sba ON p.bank_account_id = sba.id
  WHERE p.seller_id = ?
  ORDER BY p.requested_at DESC
`;

/**
 * Get total amount paid out to seller (completed payouts only)
 */
export const GET_TOTAL_PAID_OUT = `
  SELECT COALESCE(SUM(net_amount), 0) as total
  FROM payouts
  WHERE seller_id = ? AND status = 'completed'
`;

/**
 * Get seller by ID
 */
export const GET_SELLER_BY_ID = `
  SELECT
    id,
    name,
    email,
    kyc_tier,
    kyc_verified_at,
    webhook_url,
    max_transaction_amount,
    max_held_balance,
    created_at,
    updated_at
  FROM sellers
  WHERE id = ?
`;

/**
 * Get seller by email
 */
export const GET_SELLER_BY_EMAIL = `
  SELECT
    id,
    name,
    email,
    kyc_tier,
    kyc_verified_at,
    webhook_url,
    max_transaction_amount,
    max_held_balance,
    created_at,
    updated_at
  FROM sellers
  WHERE email = ?
`;

/**
 * Check if seller exists
 */
export const SELLER_EXISTS = `
  SELECT 1 as exists
  FROM sellers
  WHERE id = ?
`;

/**
 * Get seller's KYC limits
 */
export const GET_SELLER_KYC_LIMITS = `
  SELECT
    kyc_tier,
    max_transaction_amount,
    max_held_balance
  FROM sellers
  WHERE id = ?
`;

/**
 * Get seller with API key hash
 */
export const GET_SELLER_BY_API_KEY = `
  SELECT
    s.id,
    s.name,
    s.email,
    s.kyc_tier,
    s.kyc_verified_at,
    s.webhook_url,
    s.max_transaction_amount,
    s.max_held_balance,
    s.created_at,
    s.updated_at
  FROM sellers s
  JOIN api_keys ak ON s.id = ak.seller_id
  WHERE ak.key_hash = ?
    AND ak.revoked_at IS NULL
    AND (ak.expires_at IS NULL OR ak.expires_at > datetime('now'))
  LIMIT 1
`;

/**
 * Get seller's bank accounts
 */
export const GET_SELLER_BANK_ACCOUNTS = `
  SELECT
    id,
    bank_code,
    account_number,
    account_name,
    is_primary,
    verified_at,
    created_at,
    updated_at
  FROM seller_bank_accounts
  WHERE seller_id = ?
  ORDER BY is_primary DESC, created_at DESC
`;
