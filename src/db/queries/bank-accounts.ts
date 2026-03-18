/**
 * Database queries for bank accounts
 */

/**
 * Create bank account
 */
export const CREATE_BANK_ACCOUNT = `
  INSERT INTO seller_bank_accounts (
    id,
    seller_id,
    bank_code,
    account_number,
    account_name,
    is_primary,
    verified_at,
    created_at,
    updated_at
  ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
`;

/**
 * Get bank account by ID
 */
export const GET_BANK_ACCOUNT_BY_ID = `
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
 * Get bank accounts by seller ID
 */
export const GET_BANK_ACCOUNTS_BY_SELLER = `
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
  WHERE seller_id = ?
  ORDER BY is_primary DESC, created_at DESC
`;

/**
 * Get primary bank account for seller
 */
export const GET_PRIMARY_BANK_ACCOUNT = `
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
  WHERE seller_id = ? AND is_primary = 1
  LIMIT 1
`;

/**
 * Count bank accounts for seller
 */
export const COUNT_BANK_ACCOUNTS = `
  SELECT COUNT(*) as count
  FROM seller_bank_accounts
  WHERE seller_id = ?
`;

/**
 * Update bank account primary status
 */
export const UPDATE_PRIMARY_STATUS = `
  UPDATE seller_bank_accounts
  SET is_primary = ?,
      updated_at = ?
  WHERE id = ?
`;

/**
 * Set all accounts as non-primary for a seller
 */
export const CLEAR_PRIMARY_FLAGS = `
  UPDATE seller_bank_accounts
  SET is_primary = 0,
      updated_at = ?
  WHERE seller_id = ?
`;

/**
 * Delete bank account
 */
export const DELETE_BANK_ACCOUNT = `
  DELETE FROM seller_bank_accounts
  WHERE id = ?
`;

/**
 * Get bank account by account number and bank code
 */
export const GET_BANK_ACCOUNT_BY_NUMBER = `
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
  WHERE seller_id = ?
    AND bank_code = ?
    AND account_number = ?
  LIMIT 1
`;
