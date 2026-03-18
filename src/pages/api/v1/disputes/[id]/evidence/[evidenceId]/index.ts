/**
 * API Endpoint: Evidence Deletion
 *
 * DELETE /api/v1/disputes/:id/evidence/:evidenceId
 *
 * Delete specific evidence file
 */

import { EvidenceService } from '@/services/disputes/evidence';
import { R2Storage } from '@/lib/storage';
import { handleError } from '@/lib/errors';
import { createApiResponse } from '@/lib/response';
import type { APIRoute } from 'astro';

export const prerender = false;

/**
 * DELETE /api/v1/disputes/:id/evidence/:evidenceId
 *
 * Delete specific evidence
 */
export const DELETE: APIRoute = async ({ params, locals }) => {
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

    // Delete evidence
    await evidenceService.deleteEvidence(evidenceId);

    return createApiResponse({
      message: 'Evidence deleted successfully',
    });
  } catch (error) {
    return handleError(error);
  }
};
