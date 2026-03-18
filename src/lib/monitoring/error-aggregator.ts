/**
 * Error Aggregation Service
 *
 * Aggregates error statistics, calculates error rates, detects spikes,
 * and provides alerting capabilities for monitoring system health.
 */

import type { D1Database } from '@cloudflare/workers-types';
import type { ErrorLog, ErrorFilters } from './error-tracker';

/**
 * Error aggregation result
 */
export interface ErrorAggregation {
  totalErrors: number;
  errorsByType: Record<string, number>;
  errorsByCode: Record<string, number>;
  errorsByStatus: Record<string, number>;
  errorsByHour: Array<{ hour: string; count: number }>;
  topEndpoints: Array<{ endpoint: string; count: number }>;
  topUsers: Array<{ userId: string; count: number }>;
}

/**
 * Error rate metrics
 */
export interface ErrorRateMetrics {
  currentRate: number; // errors per minute
  averageRate: number; // average errors per minute
  peakRate: number; // highest error rate
  trend: 'increasing' | 'decreasing' | 'stable';
  percentageChange: number; // change from average
}

/**
 * Error spike alert
 */
export interface ErrorSpikeAlert {
  alertType: 'critical' | 'warning' | 'info';
  message: string;
  currentRate: number;
  threshold: number;
  timeWindow: string;
  recommendations: string[];
}

/**
 * Alert configuration
 */
export interface AlertConfig {
  criticalErrorRate: number; // errors per minute (default: 5% of requests)
  warningErrorRate: number; // errors per minute (default: 3% of requests)
  paymentErrorImmediate: boolean; // immediate alert on payment errors
  databaseErrorImmediate: boolean; // immediate alert on database errors
  spikeMultiplier: number; // spike detection multiplier (default: 2x)
  spikeWindowMinutes: number; // time window for spike detection (default: 5)
}

/**
 * Default alert configuration
 */
const DEFAULT_ALERT_CONFIG: AlertConfig = {
  criticalErrorRate: 5, // 5% error rate
  warningErrorRate: 3, // 3% error rate
  paymentErrorImmediate: true,
  databaseErrorImmediate: true,
  spikeMultiplier: 2.0, // 2x normal rate
  spikeWindowMinutes: 5,
};

/**
 * ErrorAggregator class for analyzing error patterns and detecting anomalies
 */
export class ErrorAggregator {
  private config: AlertConfig;
  private cache: {
    aggregation: ErrorAggregation | null;
    timestamp: number;
  } = {
    aggregation: null,
    timestamp: 0,
  };

  private readonly CACHE_TTL = 30000; // 30 seconds

  constructor(
    private db: D1Database,
    config?: Partial<AlertConfig>
  ) {
    this.config = { ...DEFAULT_ALERT_CONFIG, ...config };
  }

  /**
   * Get comprehensive error aggregation
   * Uses cache for performance
   */
  async aggregateErrors(
    filters: ErrorFilters = {}
  ): Promise<ErrorAggregation> {
    // Check cache
    const now = Date.now();
    if (
      this.cache.aggregation &&
      (now - this.cache.timestamp) < this.CACHE_TTL &&
      Object.keys(filters).length === 0
    ) {
      return this.cache.aggregation;
    }

    try {
      // Default time window: last 24 hours
      const startDate = filters.startDate || this.getStartDate(24);
      const endDate = filters.endDate || new Date().toISOString();

      // Run aggregation queries in parallel
      const [
        totalResult,
        byTypeResult,
        byCodeResult,
        byStatusResult,
        byHourResult,
        byEndpointResult,
        byUserResult,
      ] = await Promise.all([
        // Total errors
        this.db
          .prepare(
            'SELECT COUNT(*) as count FROM error_logs WHERE created_at >= ? AND created_at <= ?'
          )
          .bind(startDate, endDate)
          .first<{ count: number }>(),

        // Errors by type
        this.db
          .prepare(
            `
            SELECT error_type, COUNT(*) as count
            FROM error_logs
            WHERE created_at >= ? AND created_at <= ?
            GROUP BY error_type
            ORDER BY count DESC
            `
          )
          .bind(startDate, endDate)
          .all(),

        // Errors by code
        this.db
          .prepare(
            `
            SELECT error_code, COUNT(*) as count
            FROM error_logs
            WHERE created_at >= ? AND created_at <= ?
            GROUP BY error_code
            ORDER BY count DESC
            `
          )
          .bind(startDate, endDate)
          .all(),

        // Errors by status
        this.db
          .prepare(
            `
            SELECT status, COUNT(*) as count
            FROM error_logs
            WHERE created_at >= ? AND created_at <= ?
            GROUP BY status
            `
          )
          .bind(startDate, endDate)
          .all(),

        // Errors by hour (last 24 hours)
        this.db
          .prepare(
            `
            SELECT
              strftime('%Y-%m-%d %H:00:00', created_at) as hour,
              COUNT(*) as count
            FROM error_logs
            WHERE created_at >= ? AND created_at <= ?
            GROUP BY hour
            ORDER BY hour DESC
            LIMIT 24
            `
          )
          .bind(startDate, endDate)
          .all(),

        // Top endpoints with errors
        this.db
          .prepare(
            `
            SELECT
              COALESCE(endpoint, 'unknown') as endpoint,
              COUNT(*) as count
            FROM error_logs
            WHERE created_at >= ? AND created_at <= ?
            GROUP BY endpoint
            ORDER BY count DESC
            LIMIT 10
            `
          )
          .bind(startDate, endDate)
          .all(),

        // Top users with errors
        this.db
          .prepare(
            `
            SELECT
              COALESCE(user_id, 'anonymous') as user_id,
              COUNT(*) as count
            FROM error_logs
            WHERE created_at >= ? AND created_at <= ?
            GROUP BY user_id
            ORDER BY count DESC
            LIMIT 10
            `
          )
          .bind(startDate, endDate)
          .all(),
      ]);

      // Process results
      const aggregation: ErrorAggregation = {
        totalErrors: totalResult?.count || 0,
        errorsByType: this.arrayToRecord(byTypeResult.results || []),
        errorsByCode: this.arrayToRecord(byCodeResult.results || []),
        errorsByStatus: this.arrayToRecord(byStatusResult.results || []),
        errorsByHour: (byHourResult.results || []).map(
          (r: any) => ({ hour: r.hour, count: r.count })
        ),
        topEndpoints: (byEndpointResult.results || []).map(
          (r: any) => ({ endpoint: r.endpoint, count: r.count })
        ),
        topUsers: (byUserResult.results || []).map(
          (r: any) => ({ userId: r.user_id, count: r.count })
        ),
      };

      // Update cache
      this.cache = {
        aggregation,
        timestamp: now,
      };

      return aggregation;
    } catch (error) {
      console.error('Failed to aggregate errors:', error);
      // Return empty aggregation on error
      return {
        totalErrors: 0,
        errorsByType: {},
        errorsByCode: {},
        errorsByStatus: {},
        errorsByHour: [],
        topEndpoints: [],
        topUsers: [],
      };
    }
  }

  /**
   * Calculate error rate metrics
   */
  async calculateErrorRate(
    windowMinutes: number = 5
  ): Promise<ErrorRateMetrics> {
    try {
      const now = new Date();
      const currentWindowStart = new Date(
        now.getTime() - windowMinutes * 60 * 1000
      ).toISOString();
      const previousWindowStart = new Date(
        now.getTime() - windowMinutes * 2 * 60 * 1000
      ).toISOString();
      const previousWindowEnd = currentWindowStart;

      // Get current window errors
      const currentResult = await this.db
        .prepare(
          'SELECT COUNT(*) as count FROM error_logs WHERE created_at >= ?'
        )
        .bind(currentWindowStart)
        .first<{ count: number }>();

      // Get previous window errors for comparison
      const previousResult = await this.db
        .prepare(
          'SELECT COUNT(*) as count FROM error_logs WHERE created_at >= ? AND created_at < ?'
        )
        .bind(previousWindowStart, previousWindowEnd)
        .first<{ count: number }>();

      const currentCount = currentResult?.count || 0;
      const previousCount = previousResult?.count || 0;

      const currentRate = currentCount / windowMinutes; // errors per minute
      const averageRate = previousCount / windowMinutes; // errors per minute

      // Determine trend
      let trend: 'increasing' | 'decreasing' | 'stable' = 'stable';
      const percentageChange =
        averageRate > 0
          ? ((currentRate - averageRate) / averageRate) * 100
          : 0;

      if (percentageChange > 10) {
        trend = 'increasing';
      } else if (percentageChange < -10) {
        trend = 'decreasing';
      }

      return {
        currentRate,
        averageRate,
        peakRate: Math.max(currentRate, averageRate),
        trend,
        percentageChange,
      };
    } catch (error) {
      console.error('Failed to calculate error rate:', error);
      return {
        currentRate: 0,
        averageRate: 0,
        peakRate: 0,
        trend: 'stable',
        percentageChange: 0,
      };
    }
  }

  /**
   * Check for error spikes and return alerts
   * Also sends immediate console alerts for critical issues
   */
  async checkForSpikes(): Promise<ErrorSpikeAlert[]> {
    const alerts: ErrorSpikeAlert[] = [];
    const metrics = await this.calculateErrorRate(
      this.config.spikeWindowMinutes
    );

    // Check for critical error rate spike
    if (metrics.currentRate > this.config.criticalErrorRate) {
      const alert = {
        alertType: 'critical' as const,
        message: `Critical error rate detected: ${metrics.currentRate.toFixed(
          2
        )} errors/min`,
        currentRate: metrics.currentRate,
        threshold: this.config.criticalErrorRate,
        timeWindow: `${this.config.spikeWindowMinutes} minutes`,
        recommendations: [
          'Check recent error logs for patterns',
          'Verify database connectivity',
          'Check external service status',
          'Review recent deployments',
        ],
      };
      alerts.push(alert);
      this.sendAlert(alert);
    }
    // Check for warning error rate
    else if (metrics.currentRate > this.config.warningErrorRate) {
      const alert = {
        alertType: 'warning' as const,
        message: `Elevated error rate detected: ${metrics.currentRate.toFixed(
          2
        )} errors/min`,
        currentRate: metrics.currentRate,
        threshold: this.config.warningErrorRate,
        timeWindow: `${this.config.spikeWindowMinutes} minutes`,
        recommendations: [
          'Monitor error trends',
          'Check for specific error types',
          'Review system metrics',
        ],
      };
      alerts.push(alert);
      this.sendAlert(alert);
    }

    // Check for spike based on multiplier
    if (
      metrics.currentRate > metrics.averageRate * this.config.spikeMultiplier &&
      metrics.currentRate > 1
    ) {
      const alert = {
        alertType: 'warning' as const,
        message: `Error rate spike detected: ${metrics.percentageChange.toFixed(
          0
        )}% increase from normal`,
        currentRate: metrics.currentRate,
        threshold: metrics.averageRate * this.config.spikeMultiplier,
        timeWindow: `${this.config.spikeWindowMinutes} minutes`,
        recommendations: [
          'Investigate sudden error increase',
          'Check for recent code changes',
          'Review deployment logs',
          'Monitor system resources',
        ],
      };
      alerts.push(alert);
      this.sendAlert(alert);
    }

    return alerts;
  }

  /**
   * Check for critical errors that need immediate attention
   * Sends immediate console alerts for critical issues
   */
  async checkCriticalErrors(): Promise<ErrorSpikeAlert[]> {
    const alerts: ErrorSpikeAlert[] = [];

    try {
      const now = new Date();
      const fiveMinutesAgo = new Date(
        now.getTime() - 5 * 60 * 1000
      ).toISOString();

      // Check for payment errors
      if (this.config.paymentErrorImmediate) {
        const paymentErrors = await this.db
          .prepare(
            `
            SELECT COUNT(*) as count
            FROM error_logs
            WHERE error_code = 'PAYMENT_ERROR'
            AND created_at >= ?
            `
          )
          .bind(fiveMinutesAgo)
          .first<{ count: number }>();

        if (paymentErrors && paymentErrors.count > 0) {
          const alert = {
            alertType: 'critical' as const,
            message: `${paymentErrors.count} payment error(s) detected in last 5 minutes`,
            currentRate: paymentErrors.count / 5,
            threshold: 0,
            timeWindow: '5 minutes',
            recommendations: [
              'Check payment gateway status',
              'Verify payment credentials',
              'Review payment error logs',
              'Contact payment provider if needed',
            ],
          };
          alerts.push(alert);
          this.sendAlert(alert);
        }
      }

      // Check for database errors
      if (this.config.databaseErrorImmediate) {
        const dbErrors = await this.db
          .prepare(
            `
            SELECT COUNT(*) as count
            FROM error_logs
            WHERE (error_type = 'DatabaseError'
            OR message LIKE '%database%'
            OR message LIKE '%SQLite%')
            AND created_at >= ?
            `
          )
          .bind(fiveMinutesAgo)
          .first<{ count: number }>();

        if (dbErrors && dbErrors.count > 0) {
          const alert = {
            alertType: 'critical' as const,
            message: `${dbErrors.count} database error(s) detected in last 5 minutes`,
            currentRate: dbErrors.count / 5,
            threshold: 0,
            timeWindow: '5 minutes',
            recommendations: [
              'Check database connectivity',
              'Verify D1 service status',
              'Review database queries',
              'Check for schema issues',
            ],
          };
          alerts.push(alert);
          this.sendAlert(alert);
        }
      }
    } catch (error) {
      console.error('Failed to check critical errors:', error);
    }

    return alerts;
  }

  /**
   * Get error trend data for visualization
   */
  async getErrorTrend(hours: number = 24): Promise<
    Array<{
      timestamp: string;
      count: number;
      errorTypes: Record<string, number>;
    }>
  > {
    try {
      const startDate = this.getStartDate(hours);
      const endDate = new Date().toISOString();

      const results = await this.db
        .prepare(
          `
          SELECT
            strftime('%Y-%m-%d %H:00:00', created_at) as timestamp,
            error_type,
            COUNT(*) as count
          FROM error_logs
          WHERE created_at >= ? AND created_at <= ?
          GROUP BY timestamp, error_type
          ORDER BY timestamp DESC
          `
        )
        .bind(startDate, endDate)
        .all();

      // Aggregate by timestamp
      const trendMap = new Map<
        string,
        { count: number; errorTypes: Record<string, number> }
      >();

      for (const row of results.results || []) {
        const r = row as any;
        if (!trendMap.has(r.timestamp)) {
          trendMap.set(r.timestamp, { count: 0, errorTypes: {} });
        }
        const entry = trendMap.get(r.timestamp)!;
        entry.count += r.count;
        entry.errorTypes[r.error_type] = (entry.errorTypes[r.error_type] || 0) + r.count;
      }

      // Convert to array and sort
      return Array.from(trendMap.entries())
        .map(([timestamp, data]) => ({
          timestamp,
          count: data.count,
          errorTypes: data.errorTypes,
        }))
        .sort((a, b) => a.timestamp.localeCompare(b.timestamp));
    } catch (error) {
      console.error('Failed to get error trend:', error);
      return [];
    }
  }

  /**
   * Clear aggregation cache
   */
  clearCache(): void {
    this.cache = {
      aggregation: null,
      timestamp: 0,
    };
  }

  /**
   * Get cache age in seconds
   */
  getCacheAge(): number {
    if (!this.cache.aggregation) {
      return 0;
    }
    return Math.floor((Date.now() - this.cache.timestamp) / 1000);
  }

  /**
   * Helper: Convert array of objects to record
   */
  private arrayToRecord(
    arr: Array<{ [key: string]: any }>
  ): Record<string, number> {
    const record: Record<string, number> = {};
    for (const item of arr) {
      const key = Object.values(item)[0] as string;
      const value = Object.values(item)[1] as number;
      record[key] = value;
    }
    return record;
  }

  /**
   * Helper: Get start date for time window
   */
  private getStartDate(hours: number): string {
    const date = new Date();
    date.setHours(date.getHours() - hours);
    return date.toISOString();
  }

  /**
   * Send alert notification
   * Currently logs to console, can be extended to send emails/webhooks
   */
  private sendAlert(alert: ErrorSpikeAlert): void {
    const timestamp = new Date().toISOString();
    const emoji = alert.alertType === 'critical' ? '🚨' : '⚠️';

    console.error(
      `${emoji} ERROR ALERT [${alert.alertType.toUpperCase()}] [${timestamp}]`
    );
    console.error(`  Message: ${alert.message}`);
    console.error(`  Current Rate: ${alert.currentRate.toFixed(2)} errors/min`);
    console.error(`  Threshold: ${alert.threshold.toFixed(2)} errors/min`);
    console.error(`  Time Window: ${alert.timeWindow}`);
    console.error(`  Recommendations:`);
    alert.recommendations.forEach(rec => {
      console.error(`    - ${rec}`);
    });
    console.error('─────────────────────────────────────────────');

    // TODO: Future enhancements:
    // - Send email notifications
    // - Post to webhook (Slack, Discord, etc.)
    // - Trigger PagerDuty incidents
    // - Store alert in database for audit trail
  }
}
