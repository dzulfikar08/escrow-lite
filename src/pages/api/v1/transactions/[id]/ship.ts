import type { APIRoute } from 'astro';
import { EscrowEngine } from '@/services/escrow/engine';
import { ConfirmationService } from '@/services/escrow/confirmation';
import { jsonResponse } from '@/lib/response';
import { AuthenticationError, NotFoundError, ValidationError, handleError } from '@/lib/errors';

export const prerender = false;

/**
 * POST /api/v1/transactions/[id]/ship
 *
 * Mark transaction as shipped and send confirmation email to buyer
 *
 * Authentication: Required (Bearer token or session)
 *
 * Request Body:
 * {
 *   "tracking_number": "JP123456789" // Optional
 * }
 *
 * Response:
 * {
 *   "data": {
 *     "transaction": {...}
 *   },
 *   "meta": {
 *     "request_id": "uuid",
 *     "timestamp": "ISO-8601"
 *   }
 * }
 */
export const POST: APIRoute = async (context) => {
  const requestId = crypto.randomUUID();

  try {
    // Get DB from runtime
    const db = context.locals.runtime?.env.DB;
    if (!db) {
      return jsonResponse(
        {
          error: {
            message: 'Database not available',
            code: 'INTERNAL_ERROR',
            details: {},
          },
          meta: {
            request_id: requestId,
            timestamp: new Date().toISOString(),
          },
        },
        500
      );
    }

    // Get authenticated seller ID from session
    const session = context.locals.session;
    if (!session?.user?.id) {
      throw new AuthenticationError('Authentication required');
    }

    const sellerId = session.user.id;

    // Get transaction ID from URL
    const { id } = context.params;
    if (!id) {
      return jsonResponse(
        {
          error: {
            message: 'Transaction ID is required',
            code: 'VALIDATION_ERROR',
            details: {},
          },
          meta: {
            request_id: requestId,
            timestamp: new Date().toISOString(),
          },
        },
        400
      );
    }

    // Parse request body
    let body;
    try {
      body = await context.request.json();
    } catch (error) {
      throw new ValidationError('Invalid JSON body');
    }

    const { tracking_number } = body;

    // Validate tracking number format if provided
    if (tracking_number !== undefined && typeof tracking_number !== 'string') {
      throw new ValidationError('Tracking number must be a string');
    }

    if (tracking_number !== undefined && tracking_number.trim().length === 0) {
      throw new ValidationError('Tracking number cannot be empty');
    }

    // Initialize services
    const engine = new EscrowEngine(db);
    const confirmationService = new ConfirmationService(db, engine);

    // Get transaction
    const transaction = await engine.getTransaction(id);

    if (!transaction) {
      throw new NotFoundError(`Transaction ${id} not found`);
    }

    // Verify seller owns this transaction
    if (transaction.seller_id !== sellerId) {
      throw new AuthenticationError('You do not have permission to modify this transaction');
    }

    // Mark as shipped
    const updatedTransaction = await engine.markAsShipped(id, tracking_number);

    // Store tracking number in metadata if provided
    if (tracking_number) {
      const metadata = updatedTransaction.metadata || {};
      metadata.tracking_number = tracking_number;

      await db
        .prepare(
          `
          UPDATE transactions
          SET metadata = ?, updated_at = ?
          WHERE id = ?
        `
        )
        .bind(JSON.stringify(metadata), new Date().toISOString(), id)
        .run();
    }

    // Send confirmation email to buyer
    try {
      await confirmationService.sendConfirmationEmail(id, transaction.buyer_email);
    } catch (error) {
      // Log error but don't fail the request
      console.error(`Failed to send confirmation email for transaction ${id}:`, error);
    }

    return jsonResponse(
      {
        data: {
          transaction: updatedTransaction,
        },
        meta: {
          request_id: requestId,
          timestamp: new Date().toISOString(),
        },
      },
      200
    );
  } catch (error) {
    return handleError(error);
  }
};
