import type { APIRoute } from 'astro';
import { DisputeService } from '@/services/admin/disputes';
import { jsonResponse } from '@/lib/response';
import { AuthenticationError, handleError, AuthorizationError } from '@/lib/errors';

export const prerender = false;

/**
 * GET /admin/api/disputes
 *
 * Get list of disputes with filtering and pagination
 *
 * Authentication: Required (admin session)
 *
 * Query Parameters:
 * - status: Optional filter by dispute status (open, seller_responding, under_review, resolved, closed)
 * - page: Page number (default: 1)
 * - limit: Number of results per page (default: 50, max: 100)
 *
 * Response:
 * {
 *   "data": {
 *     "disputes": [...],
 *     "total": 100,
 *     "page": 1,
 *     "limit": 50
 *   },
 *   "meta": { ... }
 * }
 */
export const GET: APIRoute = async (context) => {
  const requestId = crypto.randomUUID();

  try {
    // Get DB from runtime
    const db = context.locals.runtime?.runtime.env.DB;
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
    // For now, we'll check if user email contains 'admin'
    const userEmail = session.user.email;
    if (!userEmail || !userEmail.includes('admin')) {
      throw new AuthorizationError('Admin access required');
    }

    // Parse query parameters
    const url = new URL(context.request.url);
    const status = url.searchParams.get('status') || undefined;
    const limitParam = url.searchParams.get('limit');
    const pageParam = url.searchParams.get('page');

    let limit = 50;
    let page = 1;

    if (limitParam) {
      const parsedLimit = parseInt(limitParam, 10);
      if (!isNaN(parsedLimit) && parsedLimit > 0 && parsedLimit <= 100) {
        limit = parsedLimit;
      }
    }

    if (pageParam) {
      const parsedPage = parseInt(pageParam, 10);
      if (!isNaN(parsedPage) && parsedPage >= 1) {
        page = parsedPage;
      }
    }

    // Initialize dispute service
    const disputeService = new DisputeService(db);

    // Get disputes
    const result = await disputeService.getDisputes({
      status,
      page,
      limit,
    });

    return jsonResponse(
      {
        data: result,
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
