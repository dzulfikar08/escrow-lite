/**
 * API Endpoint: Delete Bank Account
 *
 * DELETE /api/v1/bank-accounts/[id]
 *
 * Deletes a bank account.
 * Cannot delete primary account if there are other accounts.
 * Authentication: Required (Bearer token or session)
 */

import { BankAccountService } from '@/services/bank-accounts/service';
import { handleError } from '@/lib/errors';
import { createApiResponse } from '@/lib/response';
import { AuthenticationError } from '@/lib/errors';
import type { APIRoute } from 'astro';

export const prerender = false;

/**
 * DELETE /api/v1/bank-accounts/[id]
 *
 * Delete a bank account
 *
 * Response:
 * {
 *   "message": "Bank account deleted successfully"
 * }
 */
export const DELETE: APIRoute = async ({ params, locals }) => {
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

    // Delete account
    await bankAccountService.deleteAccount(accountId, sellerId);

    return createApiResponse({
      message: 'Bank account deleted successfully',
    });
  } catch (error) {
    return handleError(error);
  }
};
