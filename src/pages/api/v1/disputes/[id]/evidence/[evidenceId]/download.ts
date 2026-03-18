/**
 * API Endpoint: Evidence Download URL
 *
 * GET /api/v1/disputes/:id/evidence/:evidenceId/download
 *
 * Generate presigned download URL for evidence
 */

import { EvidenceService } from '@/services/disputes/evidence';
import { R2Storage } from '@/lib/storage';
import { handleError } from '@/lib/errors';
import { createApiResponse } from '@/lib/response';
import type { APIRoute } from 'astro';

export const prerender = false;

/**
 * GET /api/v1/disputes/:id/evidence/:evidenceId/download
 *
 * Get download URL for evidence (valid for 1 hour)
 */
export const GET: APIRoute = async ({ params, locals }) => {
  try {
    const { evidenceId } = params;

    if (!evidenceId) {
      return createApiResponse({ error: 'Evidence ID is required' }, 400);
    }

    // Initialize services
    const db = (locals.runtime as { env: { DB: D1Database } }).env.DB;
    const storage = new R2Storage(
      (locals.runtime as { env: { STORAGE: R2Bucket } }).env.STORAGE
    );
    const evidenceService = new EvidenceService(db, storage);

    // Generate download URL
    const downloadUrl = await evidenceService.getDownloadUrl(evidenceId);

    return createApiResponse({
      downloadUrl,
      expiresIn: 3600, // 1 hour in seconds
      message: 'Download URL generated successfully',
    });
  } catch (error) {
    return handleError(error);
  }
};
