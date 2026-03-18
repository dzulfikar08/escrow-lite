import type { APIRoute } from 'astro';
import { jsonResponse } from '@/lib/response';

export const prerender = false;

/**
 * Basic Health Check Endpoint
 *
 * GET /health
 *
 * Returns a simple health status for basic monitoring.
 * This endpoint should always return quickly and is suitable for load balancer health checks.
 */
export const GET: APIRoute = async (context) => {
  try {
    // Generate request ID for tracing
    const requestId = crypto.randomUUID();

    // Get version from package.json or use default
    const version = '0.1.0';

    return jsonResponse(
      {
        status: 'healthy',
        timestamp: new Date().toISOString(),
        version,
      },
      200,
      {
        'X-Request-ID': requestId,
        'Cache-Control': 'no-cache',
      }
    );
  } catch (error) {
    // Even in error case, we want to return a response
    // This ensures health checks don't fail due to code errors
    return jsonResponse(
      {
        status: 'unhealthy',
        timestamp: new Date().toISOString(),
        version: '0.1.0',
        error: error instanceof Error ? error.message : 'Unknown error',
      },
      503,
      {
        'X-Request-ID': crypto.randomUUID(),
      }
    );
  }
};
