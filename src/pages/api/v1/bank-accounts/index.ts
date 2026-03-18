/**
 * API Endpoint: Bank Accounts Management
 *
 * GET /api/v1/bank-accounts - List seller's bank accounts (masked)
 * POST /api/v1/bank-accounts - Add a new bank account
 *
 * Authentication: Required (Bearer token or session)
 */

import { BankAccountService } from '@/services/bank-accounts/service';
import { handleError } from '@/lib/errors';
import { createApiResponse } from '@/lib/response';
import { AuthenticationError } from '@/lib/errors';
import type { APIRoute } from 'astro';

export const prerender = false;

/**
 * GET /api/v1/bank-accounts
 *
 * Get seller's bank accounts (masked for security)
 *
 * Response:
 * {
 *   "accounts": [
 *     {
 *       "id": "bank-123",
 *       "bank_code": "BCA",
 *       "bank_name": "Bank Central Asia",
 *       "account_number_last4": "7890",
 *       "masked_account_number": "******7890",
 *       "account_name": "John Doe",
 *       "is_primary": true,
 *       "verified_at": "2024-01-15T10:00:00Z",
 *       "created_at": "2024-01-15T10:00:00Z"
 *     }
 *   ],
 *   "count": 1
 * }
 */
export const GET: APIRoute = async ({ locals }) => {
  try {
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

    // Get bank accounts (masked)
    const accounts = await bankAccountService.getBankAccountsMasked(sellerId);

    return createApiResponse({
      accounts,
      count: accounts.length,
    });
  } catch (error) {
    return handleError(error);
  }
};

/**
 * POST /api/v1/bank-accounts
 *
 * Add a new bank account
 *
 * Request body:
 * {
 *   "bank_code": "BCA",
 *   "account_number": "1234567890",
 *   "account_name": "John Doe"
 * }
 *
 * Response:
 * {
 *   "account": {
 *     "id": "bank-123",
 *     "bank_code": "BCA",
 *     "bank_name": "Bank Central Asia",
 *     "account_number_last4": "7890",
 *     "masked_account_number": "******7890",
 *     "account_name": "John Doe",
 *     "is_primary": true,
 *     "created_at": "2024-01-15T10:00:00Z"
 *   },
 *   "message": "Bank account added successfully"
 * }
 */
export const POST: APIRoute = async ({ request, locals }) => {
  try {
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

    // Parse request body
    const body = await request.json();
    const { bank_code, account_number, account_name } = body;

    // Validate required fields
    if (!bank_code) {
      return createApiResponse({ error: 'bank_code is required' }, 400);
    }

    if (!account_number) {
      return createApiResponse({ error: 'account_number is required' }, 400);
    }

    if (!account_name) {
      return createApiResponse({ error: 'account_name is required' }, 400);
    }

    // Initialize service
    const bankAccountService = new BankAccountService(db);

    // Add bank account
    const account = await bankAccountService.addBankAccount(
      sellerId,
      bank_code,
      account_number.trim(),
      account_name.trim()
    );

    // Return masked account
    const maskedAccount = {
      id: account.id,
      bank_code: account.bank_code,
      bank_name: account.bank_name,
      account_number_last4: account.account_number.slice(-4),
      masked_account_number: bankAccountService.maskAccountNumber(account.account_number),
      account_name: account.account_name,
      is_primary: account.is_primary,
      verified_at: account.verified_at,
      created_at: account.created_at,
    };

    return createApiResponse(
      {
        account: maskedAccount,
        message: 'Bank account added successfully',
      },
      201
    );
  } catch (error) {
    return handleError(error);
  }
};
