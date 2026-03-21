export const GET_SELLER_WEBHOOK_URL = `
  SELECT webhook_url
  FROM sellers
  WHERE id = ?
`;

export const CREATE_WEBHOOK_DELIVERY = `
  INSERT INTO webhook_delivery_log (
    id,
    seller_id,
    event_type,
    transaction_id,
    payout_id,
    dispute_id,
    payload,
    target_url,
    status,
    attempt_count,
    created_at
  ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'pending', 0, datetime('now'))
`;

export const GET_PENDING_WEBHOOKS = `
  SELECT
    id,
    seller_id,
    event_type,
    payload,
    target_url,
    status,
    attempt_count
  FROM webhook_delivery_log
  WHERE status IN ('pending', 'retrying')
    AND (next_retry_at IS NULL OR next_retry_at <= datetime('now'))
  ORDER BY created_at ASC
  LIMIT 50
`;

export const UPDATE_WEBHOOK_DELIVERED = `
  UPDATE webhook_delivery_log
  SET status = 'delivered',
      http_status_code = ?,
      response_body = ?,
      attempt_count = attempt_count + 1,
      delivered_at = datetime('now')
  WHERE id = ?
`;

export const UPDATE_WEBHOOK_RETRYING = `
  UPDATE webhook_delivery_log
  SET status = 'retrying',
      http_status_code = ?,
      response_body = ?,
      attempt_count = attempt_count + 1,
      next_retry_at = ?
  WHERE id = ?
`;

export const UPDATE_WEBHOOK_FAILED = `
  UPDATE webhook_delivery_log
  SET status = 'failed',
      http_status_code = ?,
      response_body = ?,
      attempt_count = attempt_count + 1,
      next_retry_at = NULL
  WHERE id = ?
`;
