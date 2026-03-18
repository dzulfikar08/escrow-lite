/**
 * API Endpoint: Evidence Upload and Management
 *
 * POST /api/v1/disputes/:id/evidence
 * - Upload evidence file for a dispute
 *
 * GET /api/v1/disputes/:id/evidence
 * - List all evidence for a dispute
 *
 * DELETE /api/v1/disputes/:id/evidence/:evidenceId
 * - Delete specific evidence
 *
 * GET /api/v1/disputes/:id/evidence/:evidenceId/download
 * - Get download URL for evidence
 */

import { EvidenceService } from '@/services/disputes/evidence';
import { R2Storage } from '@/lib/storage';
import { handleError, ValidationError } from '@/lib/errors';
import { createApiResponse } from '@/lib/response';
import type { APIRoute } from 'astro';

export const prerender = false;

/**
 * POST /api/v1/disputes/:id/evidence
 *
 * Upload evidence file for a dispute
 * Accepts multipart/form-data with file and uploaded_by field
 */
export const POST: APIRoute = async ({ request, params, locals }) => {
  try {
    const { id } = params;

    if (!id) {
      return createApiResponse({ error: 'Dispute ID is required' }, 400);
    }

    // Parse multipart form data
    const formData = await request.formData();
    const file = formData.get('file') as File | null;
    const uploadedBy = formData.get('uploaded_by') as string | null;

    // Validate file
    if (!file) {
      return createApiResponse({ error: 'file is required' }, 400);
    }

    // Validate uploader role
    if (!uploadedBy || !['buyer', 'seller'].includes(uploadedBy)) {
      return createApiResponse(
        { error: 'uploaded_by is required and must be one of: buyer, seller' },
        400
      );
    }

    // Initialize services
    const db = (locals.runtime as { env: { DB: D1Database } }).env.DB;
    const storage = new R2Storage(
      (locals.runtime as { env: { STORAGE: R2Bucket } }).env.STORAGE
    );
    const evidenceService = new EvidenceService(db, storage);

    // Upload evidence
    const evidence = await evidenceService.uploadEvidence(id, file, uploadedBy as 'buyer' | 'seller' | 'admin');

    return createApiResponse({
      evidence,
      message: 'Evidence uploaded successfully',
    });
  } catch (error) {
    return handleError(error);
  }
};

/**
 * GET /api/v1/disputes/:id/evidence
 *
 * List all evidence for a dispute
 */
export const GET: APIRoute = async ({ params, locals }) => {
  try {
    const { id } = params;

    if (!id) {
      return createApiResponse({ error: 'Dispute ID is required' }, 400);
    }

    // Initialize services
    const db = (locals.runtime as { env: { DB: D1Database } }).env.DB;
    const storage = new R2Storage(
      (locals.runtime as { env: { STORAGE: R2Bucket } }).env.STORAGE
    );
    const evidenceService = new EvidenceService(db, storage);

    // Get evidence list
    const evidence = await evidenceService.getDisputeEvidence(id);

    return createApiResponse({
      evidence,
      count: evidence.length,
    });
  } catch (error) {
    return handleError(error);
  }
};

