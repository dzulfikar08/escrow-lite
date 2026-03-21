/**
 * Midtrans Webhook Handler
 *
 * This endpoint receives payment notifications from Midtrans.
 * It verifies the signature, processes the notification, and updates
 * the transaction state and ledger accordingly.
 *
 * API Endpoint: POST /api/external/webhooks/midtrans
 *
 * Midtrans sends HTTP POST notifications with:
 * - Signature header for verification
 * - JSON payload with transaction details
 *
 * Important: Always return 200 OK to prevent Midtrans from retrying.
 */

import type { APIRoute } from 'astro';
import { MidtransService, type MidtransNotification } from '@/services/payments/midtrans';
import { AppError } from '@/lib/errors';

export const prerender = false;

export const POST: APIRoute = async ({ request, locals }) => {
  const startTime = Date.now();

  // Extract environment variables
  const serverKey = import.meta.env.MIDTRANS_SERVER_KEY;
  const apiUrl = import.meta.env.MIDTRANS_API_URL || 'https://app.sandbox.midtrans.com';

  if (!serverKey) {
    console.error('MIDTRANS_SERVER_KEY not configured');
    return new Response(
      JSON.stringify({ error: 'Server configuration error' }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }

  try {
    // Get signature from header
    const signature = request.headers.get('x-signature') || '';
    const webhookId = request.headers.get('x-webhook-id') || 'unknown';

    console.log(`[Midtrans Webhook] Received notification ${webhookId}`);

    // Parse request body
    const payload = await request.json() as Partial<MidtransNotification>;

    // Validate payload structure
    if (!payload.order_id || !payload.status_code || !payload.gross_amount) {
      console.error('[Midtrans Webhook] Invalid payload structure', payload);
      return new Response(
        JSON.stringify({ error: 'Invalid payload' }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

    // Create Midtrans service instance
    const db = (locals as any).db as D1Database;
    const midtransService = new MidtransService(serverKey, apiUrl, db);

    // Verify signature
    const isValid = await midtransService.verifyWebhook(signature, {
      order_id: payload.order_id,
      status_code: payload.status_code,
      gross_amount: payload.gross_amount,
    });

    if (!isValid) {
      console.error(`[Midtrans Webhook] Invalid signature for notification ${webhookId}`);
      // Return 200 to prevent retries, but log the error
      return new Response(
        JSON.stringify({ error: 'Invalid signature' }),
        { status: 200, headers: { 'Content-Type': 'application/json' } }
      );
    }

    console.log(`[Midtrans Webhook] Signature verified for notification ${webhookId}`);

    // Process the notification
    const result = await midtransService.processNotification(payload as MidtransNotification);

    const duration = Date.now() - startTime;
    console.log(
      `[Midtrans Webhook] Processed notification ${webhookId} for transaction ${result.transactionId} with status ${result.status} in ${duration}ms`
    );

    // Return success response
    return new Response(
      JSON.stringify({
        success: true,
        transaction_id: result.transactionId,
        status: result.status,
        webhook_id: webhookId,
      }),
      { status: 200, headers: { 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    const duration = Date.now() - startTime;
    console.error(
      `[Midtrans Webhook] Error processing notification:`,
      error
    );

    // Log error details
    if (error instanceof Error) {
      console.error(`[Midtrans Webhook] Error message: ${error.message}`);
      console.error(`[Midtrans Webhook] Error stack: ${error.stack}`);
    }

    // Always return 200 OK to prevent Midtrans from retrying
    // But include error details for debugging
    return new Response(
      JSON.stringify({
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
        duration_ms: duration,
      }),
      { status: 200, headers: { 'Content-Type': 'application/json' } }
    );
  }
};

/**
 * GET endpoint for testing webhook connectivity
 * Returns 200 OK with webhook status information
 */
export const GET: APIRoute = async ({ locals }) => {
  const serverKey = import.meta.env.MIDTRANS_SERVER_KEY;
  const apiUrl = import.meta.env.MIDTRANS_API_URL;

  return new Response(
    JSON.stringify({
      status: 'online',
      gateway: 'midtrans',
      api_url: apiUrl,
      configured: !!serverKey,
      timestamp: new Date().toISOString(),
    }),
    { status: 200, headers: { 'Content-Type': 'application/json' } }
  );
};
