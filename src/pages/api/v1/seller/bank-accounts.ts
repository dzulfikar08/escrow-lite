import type { APIRoute } from 'astro';
import * as SellerQueries from '@/db/queries/sellers';
import { jsonResponse } from '@/lib/response';
import { AuthenticationError, handleError } from '@/lib/errors';

export const prerender = false;

/**
 * GET /api/v1/seller/bank-accounts
 *
 * Get seller's bank accounts
 *
 * Authentication: Required (Bearer token or session)
 *
 * Response:
 * {
 *   "data": [
 *     {
 *       "id": "bank-123",
 *       "bank_code": "BCA",
 *       "account_number": "1234567890",
 *       "account_name": "John Doe",
 *       "is_primary": true,
 *       "verified_at": "2024-01-15T10:00:00Z"
 *     }
 *   ],
 *   "meta": {
 *     "request_id": "uuid",
 *     "timestamp": "ISO-8601"
 *   }
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

    // Get authenticated seller ID from session
    const session = context.locals.session;
    if (!session?.user?.id) {
      throw new AuthenticationError('Authentication required');
    }

    const sellerId = session.user.id;

    // Get seller's bank accounts
    const stmt = db.prepare(SellerQueries.GET_SELLER_BANK_ACCOUNTS);
    const result = await stmt.bind(sellerId).all<any>();

    const bankAccounts = result.results.map((row: any) => ({
      id: row.id,
      bank_code: row.bank_code,
      account_number: row.account_number,
      account_name: row.account_name,
      is_primary: row.is_primary === 1,
      verified_at: row.verified_at ? new Date(row.verified_at) : undefined,
      created_at: new Date(row.created_at),
      updated_at: new Date(row.updated_at),
    }));

    return jsonResponse(
      {
        data: bankAccounts,
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
