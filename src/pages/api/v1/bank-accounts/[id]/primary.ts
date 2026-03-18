/**
 * API Endpoint: Set Primary Bank Account
 *
 * POST /api/v1/bank-accounts/[id]/primary
 *
 * Sets a bank account as the primary account for payouts.
 * Authentication: Required (Bearer token or session)
 */

import { BankAccountService } from '@/services/bank-accounts/service';
import { handleError } from '@/lib/errors';
import { createApiResponse } from '@/lib/response';
import { AuthenticationError } from '@/lib/errors';
import type { APIRoute } from 'astro';

export const prerender = false;

/**
 * POST /api/v1/bank-accounts/[id]/primary
 *
 * Set a bank account as primary
 *
 * Response:
 * {
 *   "message": "Bank account set as primary successfully"
 * }
 */
export const POST: APIRoute = async ({ params, locals }) => {
  try {
    const accountId = params.id;

    // Get DB from runtime
    const db = (locals.runtime as { env: { DB: D1Database } }).env.DB;
    if (!db) {
      return createApiResponse(
        {
          error: {
            message: 'Database not available',
            code: 'INTERNAL_ERROR',
            details: {},
          },
          meta: {
            request_id: crypto.randomUUID(),
            timestamp: new Date().toISOString(),
          },
        },
        500
      );
    }

    // Get authenticated seller ID from session
    const session = locals.session;
    if (!session?.user?.id) {
      throw new AuthenticationError('Authentication required');
    }

    const sellerId = session.user.id;

    // Initialize service
    const bankAccountService = new BankAccountService(db);

    // Set as primary
    await bankAccountService.setPrimary(accountId, sellerId);

    return createApiResponse({
      message: 'Bank account set as primary successfully',
    });
  } catch (error) {
    return handleError(error);
  }
};
