import type { APIRoute } from 'astro';
import { jsonResponse } from '@/lib/response';
import { MetricsCollector } from '@/lib/monitoring/health';

export const prerender = false;

/**
 * Platform Metrics Endpoint
 *
 * GET /metrics
 *
 * Returns public platform metrics including transaction counts,
 * volume statistics, and pending items.
 *
 * Metrics are cached for 60 seconds to reduce database load.
 * This endpoint is publicly accessible for monitoring tools.
 */
export const GET: APIRoute = async (context) => {
  try {
    // Generate request ID for tracing
    const requestId = crypto.randomUUID();

    // Get environment bindings
    const env = context.locals.runtime?.env;
    if (!env) {
      throw new Error('Runtime environment not available');
    }

    const { DB } = env as {
      DB?: D1Database;
    };

    if (!DB) {
      throw new Error('Database not available');
    }

    // Create metrics collector and fetch metrics
    const metricsCollector = new MetricsCollector(DB);
    const metrics = await metricsCollector.collectMetrics();
    const cacheAge = metricsCollector.getCacheAge();

    return jsonResponse(
      {
        timestamp: new Date().toISOString(),
        metrics: {
          total_transactions: metrics.total_transactions,
          active_sellers: metrics.active_sellers,
          held_volume: metrics.held_volume,
          released_volume: metrics.released_volume,
          pending_disputes: metrics.pending_disputes,
          payouts_pending: metrics.payouts_pending,
        },
      },
      200,
      {
        'X-Request-ID': requestId,
        'Cache-Control': 'public, max-age=60', // Cache for 60 seconds
      }
    );
  } catch (error) {
    // Return error response
    return jsonResponse(
      {
        timestamp: new Date().toISOString(),
        error: error instanceof Error ? error.message : 'Unknown error',
      },
      500,
      {
        'X-Request-ID': crypto.randomUUID(),
        'Cache-Control': 'no-cache',
      }
    );
  }
};
