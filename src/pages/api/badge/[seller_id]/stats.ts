/**
 * Badge Stats API Endpoint
 *
 * Public API for retrieving seller badge statistics
 * GET /api/badge/[seller_id]/stats
 */

import { calculateSellerStats, formatBadgeStats } from '@/lib/badge/stats';
import { getDb } from '@/db/client';
import type { APIRoute } from 'astro';

export const GET: APIRoute = async ({ params, locals }) => {
  try {
    const { seller_id } = params;

    if (!seller_id) {
      return new Response(
        JSON.stringify({
          error: 'Seller ID is required',
          code: 'MISSING_SELLER_ID',
        }),
        {
          status: 400,
          headers: {
            'Content-Type': 'application/json',
            'Access-Control-Allow-Origin': '*',
            'Access-Control-Allow-Methods': 'GET',
            'Access-Control-Allow-Headers': 'Content-Type, Accept',
          },
        }
      );
    }

    // Get database connection
    const db = getDb(locals.runtime.env);

    // Calculate seller statistics
    const stats = await calculateSellerStats(db, seller_id);

    // Format for API response
    const badgeStats = formatBadgeStats(stats);

    // Return success response
    return new Response(JSON.stringify(badgeStats), {
      status: 200,
      headers: {
        'Content-Type': 'application/json',
        'Cache-Control': 'public, max-age=60', // Cache for 60 seconds
        'Access-Control-Allow-Origin': '*', // CORS for cross-origin widget requests
        'Access-Control-Allow-Methods': 'GET',
        'Access-Control-Allow-Headers': 'Content-Type, Accept',
      },
    });
  } catch (error) {
    console.error('Error fetching badge stats:', error);

    const errorMessage = error instanceof Error ? error.message : 'Unknown error';

    // Return error response
    return new Response(
      JSON.stringify({
        error: errorMessage,
        code: 'STATS_ERROR',
      }),
      {
        status: 500,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Methods': 'GET',
          'Access-Control-Allow-Headers': 'Content-Type, Accept',
        },
      }
    );
  }
};
