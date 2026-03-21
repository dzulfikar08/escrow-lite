/**
 * Error Monitoring API Endpoint
 *
 * Provides admin-only access to error tracking and statistics.
 * GET /api/v1/monitoring/errors - Get error statistics and recent errors
 */

import type { APIRoute } from 'astro';
import { verifyAdmin } from '@/lib/admin-auth';
import { ErrorTracker } from '@/lib/monitoring/error-tracker';
import { ErrorAggregator } from '@/lib/monitoring/error-aggregator';
import { jsonResponse } from '@/lib/response';

export const GET: APIRoute = async (context) => {
  try {
    // Verify admin authentication
    const admin = await verifyAdmin(context);

    // Get database from runtime
    const db = context.locals.runtime?.env.DB;
    if (!db) {
      return jsonResponse(
        { error: 'Database not available' },
        500
      );
    }

    // Parse query parameters
    const url = new URL(context.request.url);
    const action = url.searchParams.get('action') || 'stats';
    const errorType = url.searchParams.get('errorType') || undefined;
    const errorCode = url.searchParams.get('errorCode') || undefined;
    const status = url.searchParams.get('status') as
      | 'active'
      | 'resolved'
      | 'ignored'
      | undefined;
    const userId = url.searchParams.get('userId') || undefined;
    const requestId = url.searchParams.get('requestId') || undefined;
    const startDate = url.searchParams.get('startDate') || undefined;
    const endDate = url.searchParams.get('endDate') || undefined;
    const limit = url.searchParams.get('limit')
      ? parseInt(url.searchParams.get('limit')!)
      : undefined;
    const hours = url.searchParams.get('hours')
      ? parseInt(url.searchParams.get('hours')!)
      : 24;

    // Initialize services
    const errorTracker = new ErrorTracker(db);
    const errorAggregator = new ErrorAggregator(db);

    // Handle different actions
    switch (action) {
      case 'stats': {
        // Get error statistics and aggregation
        const filters: any = {};
        if (errorType) filters.errorType = errorType;
        if (errorCode) filters.errorCode = errorCode;
        if (status) filters.status = status;
        if (startDate) filters.startDate = startDate;
        if (endDate) filters.endDate = endDate;

        const [aggregation, recentErrors] = await Promise.all([
          errorAggregator.aggregateErrors(filters),
          errorTracker.getErrors({ ...filters, limit: limit || 50 }),
        ]);

        return jsonResponse({
          aggregation,
          recentErrors,
          meta: {
            requested_by: admin.email,
            filters,
            generated_at: new Date().toISOString(),
          },
        });
      }

      case 'recent': {
        // Get recent errors
        const errors = await errorTracker.getErrors({
          errorType,
          errorCode,
          status,
          userId,
          requestId,
          startDate,
          endDate,
          limit: limit || 100,
        });

        return jsonResponse({
          errors,
          count: errors.length,
          meta: {
            requested_by: admin.email,
            generated_at: new Date().toISOString(),
          },
        });
      }

      case 'rate': {
        // Get error rate metrics
        const windowMinutes = url.searchParams.get('window')
          ? parseInt(url.searchParams.get('window')!)
          : 5;

        const [metrics, spikes] = await Promise.all([
          errorAggregator.calculateErrorRate(windowMinutes),
          errorAggregator.checkForSpikes(),
        ]);

        return jsonResponse({
          metrics,
          alerts: spikes,
          meta: {
            requested_by: admin.email,
            window_minutes: windowMinutes,
            generated_at: new Date().toISOString(),
          },
        });
      }

      case 'trend': {
        // Get error trend data
        const trend = await errorAggregator.getErrorTrend(hours);

        return jsonResponse({
          trend,
          hours,
          meta: {
            requested_by: admin.email,
            generated_at: new Date().toISOString(),
          },
        });
      }

      case 'critical': {
        // Check for critical errors
        const [spikes, criticalErrors] = await Promise.all([
          errorAggregator.checkForSpikes(),
          errorAggregator.checkCriticalErrors(),
        ]);

        const allAlerts = [...spikes, ...criticalErrors];

        return jsonResponse({
          alerts: allAlerts,
          count: allAlerts.length,
          meta: {
            requested_by: admin.email,
            generated_at: new Date().toISOString(),
          },
        });
      }

      case 'export': {
        // Export errors as CSV
        const filters: any = {};
        if (errorType) filters.errorType = errorType;
        if (errorCode) filters.errorCode = errorCode;
        if (status) filters.status = status;
        if (startDate) filters.startDate = startDate;
        if (endDate) filters.endDate = endDate;

        const csv = await errorTracker.exportErrors(filters);

        return new Response(csv, {
          status: 200,
          headers: {
            'Content-Type': 'text/csv',
            'Content-Disposition': `attachment; filename="errors-${Date.now()}.csv"`,
          },
        });
      }

      default:
        return jsonResponse(
          { error: 'Invalid action', validActions: ['stats', 'recent', 'rate', 'trend', 'critical', 'export'] },
          400
        );
    }
  } catch (error) {
    // Handle authentication errors
    if (error && typeof error === 'object' && 'statusCode' in error) {
      const appError = error as { statusCode: number; message: string; code: string };
      return jsonResponse(
        { error: appError.message, code: appError.code },
        appError.statusCode
      );
    }

    // Handle other errors
    console.error('Error in monitoring API:', error);
    return jsonResponse(
      { error: 'Internal server error', code: 'INTERNAL_ERROR' },
      500
    );
  }
};

/**
 * POST endpoint for resolving/ignoring errors
 */
export const POST: APIRoute = async (context) => {
  try {
    // Verify admin authentication
    const admin = await verifyAdmin(context);

    // Get database from runtime
    const db = context.locals.runtime?.env.DB;
    if (!db) {
      return jsonResponse(
        { error: 'Database not available' },
        500
      );
    }

    // Parse request body
    const body = await context.request.json() as {
      action?: string;
      errorId?: string;
      note?: string;
    };
    const { action, errorId, note } = body;

    if (!errorId || !action) {
      return jsonResponse(
        { error: 'Missing required fields: errorId and action' },
        400
      );
    }

    const errorTracker = new ErrorTracker(db);

    // Handle different actions
    switch (action) {
      case 'resolve': {
        const success = await errorTracker.resolveError(
          errorId,
          admin.id,
          note
        );

        if (!success) {
          return jsonResponse(
            { error: 'Failed to resolve error' },
            500
          );
        }

        return jsonResponse({
          message: 'Error resolved successfully',
          errorId,
          resolvedBy: admin.email,
          resolvedAt: new Date().toISOString(),
        });
      }

      case 'ignore': {
        const success = await errorTracker.ignoreError(errorId);

        if (!success) {
          return jsonResponse(
            { error: 'Failed to ignore error' },
            500
          );
        }

        return jsonResponse({
          message: 'Error ignored successfully',
          errorId,
          ignoredBy: admin.email,
          ignoredAt: new Date().toISOString(),
        });
      }

      default:
        return jsonResponse(
          { error: 'Invalid action', validActions: ['resolve', 'ignore'] },
          400
        );
    }
  } catch (error) {
    // Handle authentication errors
    if (error && typeof error === 'object' && 'statusCode' in error) {
      const appError = error as { statusCode: number; message: string; code: string };
      return jsonResponse(
        { error: appError.message, code: appError.code },
        appError.statusCode
      );
    }

    // Handle other errors
    console.error('Error in monitoring API POST:', error);
    return jsonResponse(
      { error: 'Internal server error', code: 'INTERNAL_ERROR' },
      500
    );
  }
};
