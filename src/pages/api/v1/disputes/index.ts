/**
 * API Endpoint: Open Dispute
 *
 * POST /api/v1/disputes
 *
 * Allows buyers to open a dispute for a transaction.
 * The transaction must be in HELD status.
 */

import { DisputeService } from '@/services/disputes/service';
import { EscrowEngine } from '@/services/escrow/engine';
import { LedgerService } from '@/services/escrow/ledger';
import { DisputeReason } from '@/services/disputes/types';
import { handleError } from '@/lib/errors';
import { createApiResponse } from '@/lib/response';
import type { APIRoute } from 'astro';

export const prerender = false;

function isDisputeReason(value: string): value is DisputeReason {
  return Object.values(DisputeReason).includes(value as DisputeReason);
}

export const POST: APIRoute = async ({ request, locals }) => {
  try {
    // Parse request body
    const body = await request.json() as {
      transaction_id?: string;
      reason?: string;
      description?: string;
      buyer_email?: string;
    };
    const { transaction_id, reason, description, buyer_email } = body;

    // Validate required fields
    if (!transaction_id) {
      return createApiResponse({ error: 'transaction_id is required' }, 400);
    }

    if (!reason) {
      return createApiResponse({ error: 'reason is required' }, 400);
    }

    if (!buyer_email) {
      return createApiResponse({ error: 'buyer_email is required' }, 400);
    }

    // Validate reason
    const validReasons = Object.values(DisputeReason);
    if (!isDisputeReason(reason)) {
      return createApiResponse(
        {
          error: `Invalid reason. Must be one of: ${validReasons.join(', ')}`,
        },
        400
      );
    }

    // Initialize services
    const db = locals.runtime?.env.DB;
    if (!db) {
      return createApiResponse({ error: 'Database not available' }, 500);
    }
    const engine = new EscrowEngine(db);
    const ledger = new LedgerService(db);
    const disputeService = new DisputeService(db, engine, ledger);

    // Open dispute
    const dispute = await disputeService.openDispute(transaction_id, reason, description || '', buyer_email);

    return createApiResponse(
      {
        dispute,
        message: 'Dispute opened successfully',
      },
      201
    );
  } catch (error) {
    return handleError(error);
  }
};

/**
 * GET /api/v1/disputes
 *
 * List disputes with optional filters
 */
export const GET: APIRoute = async ({ url, locals }) => {
  try {
    const status = url.searchParams.get('status');
    const limit = parseInt(url.searchParams.get('limit') || '50');
    const offset = parseInt(url.searchParams.get('offset') || '0');

    // Initialize services
    const db = locals.runtime?.env.DB;
    if (!db) {
      return createApiResponse({ error: 'Database not available' }, 500);
    }
    const engine = new EscrowEngine(db);
    const ledger = new LedgerService(db);
    const disputeService = new DisputeService(db, engine, ledger);

    // List disputes
    const disputes = await disputeService.listDisputes({
      status: status as any,
      limit,
      offset,
    });

    return createApiResponse({
      disputes,
      count: disputes.length,
      limit,
      offset,
    });
  } catch (error) {
    return handleError(error);
  }
};
