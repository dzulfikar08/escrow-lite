import type { APIRoute } from 'astro';
import { DisputeService } from '@/services/admin/disputes';
import type { DisputeResolution } from '@/services/admin/types';
import { jsonResponse } from '@/lib/response';
import { AuthenticationError, handleError, AuthorizationError, NotFoundError, ValidationError } from '@/lib/errors';

export const prerender = false;

function isDisputeResolution(value: string): value is DisputeResolution {
  return ['released_to_seller', 'refunded_to_buyer', 'partial', 'rejected'].includes(value);
}

/**
 * POST /admin/api/disputes/[id]/resolve
 *
 * Resolve a dispute with admin decision
 *
 * Authentication: Required (admin session)
 *
 * Request Body:
 * {
 *   "resolution": "released_to_seller" | "refunded_to_buyer" | "partial" | "rejected",
 *   "note": "Admin notes explaining the decision"
 * }
 *
 * Response:
 * {
 *   "data": {
 *     "success": true
 *   },
 *   "meta": { ... }
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

    // Parse request body
    const body = await context.request.json() as {
      resolution?: string;
      note?: string;
    };
    const { resolution, note } = body;

    // Validate resolution
    const validResolutions: DisputeResolution[] = ['released_to_seller', 'refunded_to_buyer', 'partial', 'rejected'];
    if (!resolution || !isDisputeResolution(resolution)) {
      throw new ValidationError(
        `Invalid resolution. Must be one of: ${validResolutions.join(', ')}`
      );
    }

    // Validate note
    if (!note || typeof note !== 'string' || note.trim().length === 0) {
      throw new ValidationError('Note is required and must not be empty');
    }

    // Initialize dispute service
    const disputeService = new DisputeService(db);

    // Resolve dispute
    const result = await disputeService.resolveDispute(id, {
      resolution,
      note: note.trim(),
      admin_id: session.user.id,
    });

    if (!result.success) {
      return jsonResponse(
        {
          error: {
            message: result.error || 'Failed to resolve dispute',
            code: 'RESOLUTION_FAILED',
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

    return jsonResponse(
      {
        data: {
          success: true,
          message: 'Dispute resolved successfully',
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
