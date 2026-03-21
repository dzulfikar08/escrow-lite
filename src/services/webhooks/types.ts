export type WebhookEventType =
  | 'transaction.funded'
  | 'transaction.released'
  | 'transaction.disputed'
  | 'transaction.refunded'
  | 'payout.completed'
  | 'payout.failed';

export type WebhookDeliveryStatus = 'pending' | 'delivered' | 'failed' | 'retrying';

export interface WebhookDeliveryRecord {
  id: string;
  seller_id: string;
  event_type: WebhookEventType;
  transaction_id: string | null;
  payout_id: string | null;
  dispute_id: string | null;
  payload: string;
  target_url: string;
  status: WebhookDeliveryStatus;
  http_status_code: number | null;
  response_body: string | null;
  attempt_count: number;
  next_retry_at: string | null;
  delivered_at: string | null;
  created_at: string;
}

export interface WebhookPayload {
  id: string;
  event: WebhookEventType;
  data: Record<string, unknown>;
  created_at: string;
}

export interface SendWebhookOptions {
  transaction_id?: string;
  payout_id?: string;
  dispute_id?: string;
}

export interface ProcessQueueResult {
  processed: number;
  delivered: number;
  failed: number;
  retrying: number;
}
