import type { D1Database } from '@cloudflare/workers-types';
import type {
  WebhookEventType,
  WebhookPayload,
  SendWebhookOptions,
  ProcessQueueResult,
} from './types';
import {
  GET_SELLER_WEBHOOK_URL,
  CREATE_WEBHOOK_DELIVERY,
  GET_PENDING_WEBHOOKS,
  UPDATE_WEBHOOK_DELIVERED,
  UPDATE_WEBHOOK_RETRYING,
  UPDATE_WEBHOOK_FAILED,
} from '@/db/queries/webhooks';

const RETRY_DELAYS = [60, 300, 1800, 7200, 21600, 86400];
const MAX_ATTEMPTS = 7;

export async function sendWebhook(
  db: D1Database,
  sellerId: string,
  eventType: WebhookEventType,
  payload: Record<string, unknown>,
  options?: SendWebhookOptions
): Promise<string | null> {
  const seller = await db
    .prepare(GET_SELLER_WEBHOOK_URL)
    .bind(sellerId)
    .first<{ webhook_url: string | null }>();

  if (!seller?.webhook_url) {
    return null;
  }

  const webhookPayload: WebhookPayload = {
    id: crypto.randomUUID(),
    event: eventType,
    data: payload,
    created_at: new Date().toISOString(),
  };

  const id = crypto.randomUUID();

  await db
    .prepare(CREATE_WEBHOOK_DELIVERY)
    .bind(
      id,
      sellerId,
      eventType,
      options?.transaction_id ?? null,
      options?.payout_id ?? null,
      options?.dispute_id ?? null,
      JSON.stringify(webhookPayload),
      seller.webhook_url
    )
    .run();

  return id;
}

async function signPayload(
  payload: string,
  secret: string
): Promise<{ timestamp: string; signature: string }> {
  const timestamp = Math.floor(Date.now() / 1000).toString();
  const message = `${timestamp}.${payload}`;

  const encoder = new TextEncoder();
  const key = await crypto.subtle.importKey(
    'raw',
    encoder.encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  );

  const sig = await crypto.subtle.sign('HMAC', key, encoder.encode(message));
  const hex = Array.from(new Uint8Array(sig))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');

  return { timestamp, signature: hex };
}

export async function processWebhookQueue(
  db: D1Database,
  env: { WEBHOOK_SIGNING_SECRET: string }
): Promise<ProcessQueueResult> {
  const result = await db.prepare(GET_PENDING_WEBHOOKS).all<{
    id: string;
    event_type: string;
    payload: string;
    target_url: string;
    attempt_count: number;
  }>();

  const stats: ProcessQueueResult = {
    processed: 0,
    delivered: 0,
    failed: 0,
    retrying: 0,
  };

  for (const webhook of result.results) {
    try {
      const { timestamp, signature } = await signPayload(
        webhook.payload,
        env.WEBHOOK_SIGNING_SECRET
      );

      const response = await fetch(webhook.target_url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Webhook-Signature': `t=${timestamp},v1=${signature}`,
          'X-Webhook-ID': webhook.id,
          'X-Webhook-Event': webhook.event_type,
        },
        body: webhook.payload,
      });

      const responseBody = await response.text().catch(() => '');
      const newAttemptCount = webhook.attempt_count + 1;

      if (response.ok) {
        await db
          .prepare(UPDATE_WEBHOOK_DELIVERED)
          .bind(response.status, responseBody, webhook.id)
          .run();
        stats.delivered++;
      } else if (newAttemptCount >= MAX_ATTEMPTS) {
        await db
          .prepare(UPDATE_WEBHOOK_FAILED)
          .bind(response.status, responseBody, webhook.id)
          .run();
        stats.failed++;
      } else {
        const delay = RETRY_DELAYS[webhook.attempt_count] ?? RETRY_DELAYS[RETRY_DELAYS.length - 1];
        const nextRetryAt = new Date(Date.now() + delay * 1000).toISOString();

        await db
          .prepare(UPDATE_WEBHOOK_RETRYING)
          .bind(response.status, responseBody, nextRetryAt, webhook.id)
          .run();
        stats.retrying++;
      }

      stats.processed++;
    } catch (error) {
      const newAttemptCount = webhook.attempt_count + 1;
      const errorMsg = error instanceof Error ? error.message : 'Unknown error';

      if (newAttemptCount >= MAX_ATTEMPTS) {
        await db.prepare(UPDATE_WEBHOOK_FAILED).bind(null, errorMsg, webhook.id).run();
        stats.failed++;
      } else {
        const delay = RETRY_DELAYS[webhook.attempt_count] ?? RETRY_DELAYS[RETRY_DELAYS.length - 1];
        const nextRetryAt = new Date(Date.now() + delay * 1000).toISOString();

        await db
          .prepare(UPDATE_WEBHOOK_RETRYING)
          .bind(null, errorMsg, nextRetryAt, webhook.id)
          .run();
        stats.retrying++;
      }

      stats.processed++;
    }
  }

  return stats;
}
