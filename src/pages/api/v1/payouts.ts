import type { APIRoute } from 'astro';
import { BalanceService } from '@/services/escrow/balance';
import { LedgerService } from '@/services/escrow/ledger';
import * as SellerQueries from '@/db/queries/sellers';
import { jsonResponse, validationErrorResponse } from '@/lib/response';
import { AuthenticationError, ValidationError, handleError } from '@/lib/errors';

export const prerender = false;

const MIN_PAYOUT_AMOUNT = 50000;
const PAYOUT_FEE = 2500;

/**
 * POST /api/v1/payouts
 *
 * Create a new payout request
 *
 * Authentication: Required (Bearer token or session)
 *
 * Request Body:
 * {
 *   "amount": 100000,
 *   "bank_account_id": "bank-123",
 *   "notes": "Optional notes"
 * }
 *
 * Response:
 * {
 *   "data": {
 *     "id": "payout-123",
 *     "amount": 100000,
 *     "fee_amount": 2500,
 *     "net_amount": 97500,
 *     "status": "pending",
 *     ...
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

    // Parse request body
    const body = await context.request.json() as {
      amount?: number;
      bank_account_id?: string;
      notes?: string;
    };
    const { amount, bank_account_id, notes } = body;

    // Validate amount
    if (!amount || typeof amount !== 'number') {
      throw new ValidationError('Amount is required and must be a number');
    }

    if (amount < MIN_PAYOUT_AMOUNT) {
      throw new ValidationError(`Minimum payout amount is Rp ${MIN_PAYOUT_AMOUNT.toLocaleString('id-ID')}`);
    }

    if (!Number.isInteger(amount)) {
      throw new ValidationError('Amount must be an integer');
    }

    // Validate bank account ID
    if (!bank_account_id || typeof bank_account_id !== 'string') {
      throw new ValidationError('Bank account ID is required');
    }

    // Initialize services
    const ledger = new LedgerService(db);
    const balanceService = new BalanceService(db, ledger);

    // Get seller's current balances
    const balances = await balanceService.getSellerBalances(sellerId);

    // Validate sufficient funds
    if (amount > balances.available_balance) {
      throw new ValidationError('Insufficient available balance');
    }

    // Verify bank account belongs to seller
    const bankAccountStmt = db.prepare(SellerQueries.GET_SELLER_BANK_ACCOUNTS);
    const bankAccountResult = await bankAccountStmt.bind(sellerId).all<any>();
    const bankAccount = bankAccountResult.results.find(
      (ba: any) => ba.id === bank_account_id
    );

    if (!bankAccount) {
      throw new ValidationError('Bank account not found or does not belong to you');
    }

    // Calculate fee and net amount
    const feeAmount = PAYOUT_FEE;
    const netAmount = amount - feeAmount;

    // Create payout record
    const payoutId = crypto.randomUUID();
    const now = new Date().toISOString();

    const createPayoutStmt = db.prepare(`
      INSERT INTO payouts (
        id,
        seller_id,
        amount,
        fee_amount,
        net_amount,
        bank_account_id,
        status,
        requested_at,
        metadata,
        created_at,
        updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, 'pending', ?, ?, ?, ?)
    `);

    await createPayoutStmt.bind(
      payoutId,
      sellerId,
      amount,
      feeAmount,
      netAmount,
      bank_account_id,
      now,
      notes ? JSON.stringify({ notes }) : null,
      now,
      now
    ).run();

    // Create ledger entry for payout
    const ledgerEntryId = crypto.randomUUID();
    const balanceAfter = balances.available_balance - amount;

    const ledgerStmt = db.prepare(`
      INSERT INTO ledger_entries (
        id,
        seller_id,
        payout_id,
        type,
        amount,
        direction,
        balance_after,
        note,
        created_at
      ) VALUES (?, ?, ?, 'payout', ?, 'debit', ?, ?, ?)
    `);

    await ledgerStmt.bind(
      ledgerEntryId,
      sellerId,
      payoutId,
      amount,
      balanceAfter,
      notes || 'Payout request'
    ).run();

    // Fetch the created payout
    const payoutStmt = db.prepare(SellerQueries.GET_SELLER_PAYOUTS);
    const payoutResult = await payoutStmt.bind(sellerId).all<any>();
    const createdPayout = payoutResult.results.find((p: any) => p.id === payoutId);

    if (!createdPayout) {
      throw new Error('Failed to retrieve created payout');
    }

    return jsonResponse(
      {
        data: {
          id: createdPayout.id,
          amount: createdPayout.amount,
          fee_amount: createdPayout.fee_amount,
          net_amount: createdPayout.net_amount,
          status: createdPayout.status,
          bank_code: createdPayout.bank_code,
          account_number: createdPayout.account_number,
          account_name: createdPayout.account_name,
          requested_at: createdPayout.requested_at,
          created_at: createdPayout.created_at,
          updated_at: createdPayout.updated_at,
        },
        meta: {
          request_id: requestId,
          timestamp: new Date().toISOString(),
        },
      },
      201
    );
  } catch (error) {
    return handleError(error);
  }
};
