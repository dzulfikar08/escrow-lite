import type { APIRoute } from 'astro';
import { DisputeService } from '@/services/admin/disputes';
import { jsonResponse } from '@/lib/response';
import { AuthenticationError, handleError, AuthorizationError, NotFoundError } from '@/lib/errors';

export const prerender = false;

/**
 * GET /admin/api/disputes/[id]
 *
 * Get detailed dispute information including evidence
 *
 * Authentication: Required (admin session)
 *
 * Response:
 * {
 *   "data": {
 *     "id": "uuid",
 *     "transaction_id": "uuid",
 *     "status": "open",
 *     "evidence": [...],
 *     "transaction": {...}
 *   },
 *   "meta": { ... }
 * }
 */
export const GET: APIRoute = async (context) => {
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

    // Check admin authentication
    const session = context.locals.session;
    if (!session?.user?.id) {
      throw new AuthenticationError('Authentication required');
    }

    // TODO: Verify admin role
    const userEmail = session.user.email;
    if (!userEmail || !userEmail.includes('admin')) {
      throw new AuthorizationError('Admin access required');
    }

    // Get dispute ID from URL
    const id = context.params.id;
    if (!id) {
      throw new NotFoundError('Dispute ID required');
    }

    // Initialize dispute service
    const disputeService = new DisputeService(db);

    // Get dispute details
    const dispute = await disputeService.getDisputeById(id);

    if (!dispute) {
      throw new NotFoundError('Dispute not found');
    }

    return jsonResponse(
      {
        data: dispute,
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
