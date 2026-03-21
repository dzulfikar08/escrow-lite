import type { APIContext } from 'astro';
import { ConfirmationService } from '@/services/escrow/confirmation';
import { EscrowEngine } from '@/services/escrow/engine';
import { handleError } from '@/lib/errors';

/**
 * GET /api/v1/transactions/[id]/confirm
 *
 * Buyer confirmation endpoint for releasing held funds.
 *
 * Query parameters:
 * - token: Single-use confirmation token from email
 *
 * Flow:
 * 1. Validate token from query params
 * 2. Check token is not expired or already used
 * 3. Verify transaction is in HELD status
 * 4. Mark token as used
 * 5. Release funds to seller (HELD → RELEASED)
 * 6. Redirect to success page
 *
 * Error responses:
 * - 400: Invalid or missing token
 * - 404: Transaction not found
 * - 409: Token already used or invalid transaction status
 * - 410: Token expired
 *
 * Success responses:
 * - 302: Redirect to confirmation success page
 * - 200: JSON response (if redirect not possible)
 */
export async function GET(context: APIContext): Promise<Response> {
  try {
    const { id } = context.params;
    const url = new URL(context.request.url);
    const token = url.searchParams.get('token');

    // Validate transaction ID
    if (!id) {
      return new Response(
        JSON.stringify({
          error: {
            message: 'Transaction ID is required',
            code: 'VALIDATION_ERROR',
          },
        }),
        {
          status: 400,
          headers: { 'Content-Type': 'application/json' },
        }
      );
    }

    // Validate token
    if (!token) {
      return new Response(
        JSON.stringify({
          error: {
            message: 'Confirmation token is required',
            code: 'VALIDATION_ERROR',
          },
        }),
        {
          status: 400,
          headers: { 'Content-Type': 'application/json' },
        }
      );
    }

    // Initialize services
    const db = context.locals.runtime?.env.DB;
    if (!db) {
      throw new Error('Database not available');
    }

    const engine = new EscrowEngine(db);
    const confirmationService = new ConfirmationService(db, engine);

    // Confirm receipt and release funds
    const transaction = await confirmationService.confirmReceipt(token);

    // Check if client expects JSON response (API clients)
    const acceptHeader = context.request.headers.get('accept');
    const isApiRequest = acceptHeader?.includes('application/json');

    if (isApiRequest) {
      // Return JSON response for API clients
      return new Response(
        JSON.stringify({
          success: true,
          message: 'Funds have been released to seller',
          data: {
            transaction_id: transaction.id,
            status: transaction.status,
            released_at: transaction.released_at,
          },
        }),
        {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        }
      );
    }

    // Redirect to success page for browser clients
    const baseUrl = context.locals.runtime?.env.PUBLIC_URL || 'http://localhost:4321';
    const successUrl = new URL('/confirm/success', baseUrl);
    successUrl.searchParams.set('transaction_id', transaction.id);

    return Response.redirect(successUrl.toString(), 302);
  } catch (error) {
    // Handle errors and return appropriate response
    const errorResponse = handleError(error);

    // For browser clients, redirect to error page
    const acceptHeader = context.request.headers.get('accept');
    const isApiRequest = acceptHeader?.includes('application/json');

    if (!isApiRequest && error instanceof Error) {
      const baseUrl = context.locals.runtime?.env.PUBLIC_URL || 'http://localhost:4321';
      const errorUrl = new URL('/confirm/error', baseUrl);
      errorUrl.searchParams.set('message', encodeURIComponent(error.message));

      return Response.redirect(errorUrl.toString(), 302);
    }

    return errorResponse;
  }
}

/**
 * Handle OPTIONS requests for CORS
 */
export async function OPTIONS(context: APIContext): Promise<Response> {
  return new Response(null, {
    status: 204,
    headers: {
      'Access-Control-Allow-Methods': 'GET, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    },
  });
}
