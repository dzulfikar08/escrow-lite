/**
 * Dispute database queries
 * SQL queries for dispute management
 */

export const CREATE_DISPUTE = `
  INSERT INTO disputes (
    id, transaction_id, reason, description, status,
    buyer_email, evidence_count, created_at, updated_at
  ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
`;

export const GET_DISPUTE_BY_ID = `
  SELECT * FROM disputes WHERE id = ?
`;

export const GET_DISPUTE_BY_TRANSACTION = `
  SELECT * FROM disputes WHERE transaction_id = ? ORDER BY created_at DESC
`;

export const GET_DISPUTES_BY_SELLER = `
  SELECT d.* FROM disputes d
  INNER JOIN transactions t ON d.transaction_id = t.id
  WHERE t.seller_id = ?
  ORDER BY d.created_at DESC
  LIMIT ? OFFSET ?
`;

export const LIST_DISPUTES = `
  SELECT * FROM disputes
  WHERE (?1 IS NULL OR status = ?1)
  ORDER BY created_at DESC
  LIMIT ?2 OFFSET ?3
`;

export const UPDATE_DISPUTE_STATUS = `
  UPDATE disputes
  SET status = ?, updated_at = ?
  WHERE id = ?
`;

export const ADD_DISPUTE_EVIDENCE = `
  INSERT INTO dispute_evidence (
    id, dispute_id, file_name, file_url, file_type, uploaded_by, created_at
  ) VALUES (?, ?, ?, ?, ?, ?, ?)
`;

export const GET_DISPUTE_EVIDENCE = `
  SELECT * FROM dispute_evidence WHERE dispute_id = ? ORDER BY created_at ASC
`;

export const UPDATE_SELLER_RESPONSE = `
  UPDATE disputes
  SET
    seller_response = ?,
    seller_responded_at = ?,
    status = ?,
    updated_at = ?
  WHERE id = ?
`;

export const RESOLVE_DISPUTE = `
  UPDATE disputes
  SET
    status = ?,
    resolution = ?,
    resolved_for = ?,
    resolved_by = ?,
    resolved_at = ?,
    admin_notes = ?,
    updated_at = ?
  WHERE id = ?
`;

export const GET_TRANSACTION_BY_DISPUTE = `
  SELECT t.* FROM transactions t
  INNER JOIN disputes d ON t.id = d.transaction_id
  WHERE d.id = ?
`;

export const COUNT_DISPUTES_BY_TRANSACTION = `
  SELECT COUNT(*) as count FROM disputes WHERE transaction_id = ?
`;

export const GET_SELLER_FROM_DISPUTE = `
  SELECT t.seller_id FROM transactions t
  INNER JOIN disputes d ON t.id = d.transaction_id
  WHERE d.id = ?
`;

export const UPDATE_EVIDENCE_COUNT = `
  UPDATE disputes
  SET evidence_count = (
    SELECT COUNT(*) FROM dispute_evidence WHERE dispute_id = ?
  ),
  updated_at = ?
  WHERE id = ?
`;
