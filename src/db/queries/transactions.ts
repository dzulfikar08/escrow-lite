export const CREATE_TRANSACTION = `
  INSERT INTO transactions (
    id,
    seller_id,
    buyer_email,
    buyer_phone,
    amount,
    fee_rate,
    fee_amount,
    net_amount,
    gateway,
    status,
    auto_release_days,
    auto_release_at,
    absolute_expire_at,
    payment_link,
    metadata,
    created_at,
    updated_at
  ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
`;

export const GET_TRANSACTION_BY_ID = `
  SELECT
    id,
    seller_id,
    buyer_email,
    buyer_phone,
    amount,
    fee_rate,
    fee_amount,
    net_amount,
    gateway,
    gateway_ref,
    payment_method,
    payment_link,
    auto_release_days,
    auto_release_at,
    absolute_expire_at,
    shipped_at,
    tracking_number,
    courier,
    status,
    released_at,
    release_reason,
    refunded_at,
    refund_reason,
    metadata,
    last_checked_at,
    created_at,
    updated_at
  FROM transactions
  WHERE id = ?
`;

export const LIST_TRANSACTIONS = `
  SELECT
    id,
    seller_id,
    buyer_email,
    buyer_phone,
    amount,
    fee_rate,
    fee_amount,
    net_amount,
    gateway,
    gateway_ref,
    payment_method,
    payment_link,
    auto_release_days,
    auto_release_at,
    absolute_expire_at,
    shipped_at,
    status,
    released_at,
    release_reason,
    refunded_at,
    metadata,
    created_at,
    updated_at
  FROM transactions
  WHERE seller_id = ?
  /*CONDITIONAL*/
  ORDER BY created_at DESC
  LIMIT ? OFFSET ?
`;

export const COUNT_TRANSACTIONS = `
  SELECT COUNT(*) as count
  FROM transactions
  WHERE seller_id = ?
  /*CONDITIONAL*/
`;

export const UPDATE_TRANSACTION_STATUS = `
  UPDATE transactions
  SET status = ?, updated_at = datetime('now')
  WHERE id = ?
`;

export const UPDATE_PAYMENT_LINK = `
  UPDATE transactions
  SET payment_link = ?, updated_at = datetime('now')
  WHERE id = ?
`;

export const GET_EXPIRED_TRANSACTIONS = `
  SELECT
    id,
    seller_id,
    buyer_email,
    amount,
    net_amount,
    status,
    auto_release_at,
    absolute_expire_at,
    last_checked_at,
    gateway_ref
  FROM transactions
  WHERE status = 'held'
    AND (
      auto_release_at <= datetime('now')
      OR absolute_expire_at <= datetime('now')
    )
    AND (
      last_checked_at IS NULL
      OR last_checked_at < auto_release_at
      OR last_checked_at < absolute_expire_at
    )
  LIMIT 100
`;

export const GET_PENDING_GATEWAY_TRANSACTIONS = `
  SELECT
    id,
    seller_id,
    buyer_email,
    buyer_phone,
    amount,
    status,
    gateway,
    gateway_ref,
    created_at
  FROM transactions
  WHERE status = 'pending'
    AND created_at >= datetime('now', '-24 hours')
    AND gateway IS NOT NULL
  ORDER BY created_at ASC
  LIMIT 50
`;
