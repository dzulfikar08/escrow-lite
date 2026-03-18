/**
 * API Endpoint: Seller Dispute Response
 *
 * POST /api/v1/disputes/:id/respond
 *
 * Allows sellers to respond to a dispute opened against their transaction.
 * Sellers can only respond once.
 */

import { DisputeService } from '@/services/disputes/service';
import { EscrowEngine } from '@/services/escrow/engine';
import { LedgerService } from '@/services/escrow/ledger';
import { handleError } from '@/lib/errors';
import { createApiResponse } from '@/lib/response';
import type { APIRoute } from 'astro';

export const prerender = false;

export const POST: APIRoute = async ({ request, params, locals }) => {
  try {
    const { id } = params;

    if (!id) {
      return createApiResponse({ error: 'Dispute ID is required' }, 400);
    }

    // Parse request body
    const body = await request.json();
    const { seller_id, response } = body;

    // Validate required fields
    if (!seller_id) {
      return createApiResponse({ error: 'seller_id is required' }, 400);
    }

    if (!response || typeof response !== 'string') {
      return createApiResponse({ error: 'response is required and must be a string' }, 400);
    }

    if (response.length < 10) {
      return createApiResponse({ error: 'response must be at least 10 characters' }, 400);
    }

    // Initialize services
    const db = (locals.runtime as { env: { DB: D1Database } }).env.DB;
    const engine = new EscrowEngine(db);
    const ledger = new LedgerService(db);
    const disputeService = new DisputeService(db, engine, ledger);

    // Submit seller response
    const updatedDispute = await disputeService.sellerResponse(id, seller_id, response);

    return createApiResponse({
      dispute: updatedDispute,
      message: 'Seller response submitted successfully',
    });
  } catch (error) {
    return handleError(error);
  }
};

/**
 * GET /api/v1/disputes/:id
 *
 * Get dispute details
 */
export const GET: APIRoute = async ({ params, locals }) => {
  try {
    const { id } = params;

    if (!id) {
      return createApiResponse({ error: 'Dispute ID is required' }, 400);
    }

    // Initialize services
    const db = (locals.runtime as { env: { DB: D1Database } }).env.DB;
    const engine = new EscrowEngine(db);
    const ledger = new LedgerService(db);
    const disputeService = new DisputeService(db, engine, ledger);

    // Get dispute
    const dispute = await disputeService.getDispute(id);

    if (!dispute) {
      return createApiResponse({ error: 'Dispute not found' }, 404);
    }

    return createApiResponse({ dispute });
  } catch (error) {
    return handleError(error);
  }
};
