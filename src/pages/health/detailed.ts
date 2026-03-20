import type { APIRoute } from 'astro';
import { jsonResponse } from '@/lib/response';
import { HealthChecker } from '@/lib/monitoring/health';

export const prerender = false;

/**
 * Detailed Health Check Endpoint
 *
 * GET /health/detailed
 *
 * Returns detailed health status including checks for:
 * - Database connectivity (D1)
 * - Storage availability (R2)
 * - Payment gateway status (Midtrans)
 *
 * This endpoint performs actual checks against system components
 * and may take longer than the basic health check.
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

    const { DB, R2_BUCKET, MIDTRANS_API_URL, MIDTRANS_SERVER_KEY } = env as {
      DB?: D1Database;
      R2_BUCKET?: R2Bucket;
      MIDTRANS_API_URL?: string;
      MIDTRANS_SERVER_KEY?: string;
    };

    if (!DB || !R2_BUCKET) {
      throw new Error('Required services not available');
    }

    // Create health checker
    const healthChecker = new HealthChecker(
      DB,
      R2_BUCKET,
      MIDTRANS_API_URL || 'https://app.midtrans.com',
      MIDTRANS_SERVER_KEY || ''
    );

    // Perform all health checks
    const checks = await healthChecker.performAllChecks();

    // Get overall status
    const overallStatus = healthChecker.getOverallStatus(checks);

    // Determine HTTP status code based on overall health
    const httpStatus = overallStatus === 'healthy' ? 200 : overallStatus === 'degraded' ? 200 : 503;

    // Get version
    const version = '0.1.0';

    return jsonResponse(
      {
        status: overallStatus,
        timestamp: new Date().toISOString(),
        version,
        checks: {
          database: checks.database.status,
          storage: checks.storage.status,
          payments: checks.payments.status,
        },
      },
      httpStatus,
      {
        'X-Request-ID': requestId,
        'Cache-Control': 'no-cache',
      }
    );
  } catch (error) {
    // Return error response
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
