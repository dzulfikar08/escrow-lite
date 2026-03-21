/**
 * Health Check Utilities
 *
 * Provides utilities for checking the health of various system components
 * including database, storage, and external services.
 */

import type { D1Database } from '@cloudflare/workers-types';

type CompatibleR2Bucket = {
  list(options?: { limit?: number }): Promise<unknown>;
};

export interface HealthCheckResult {
  status: 'healthy' | 'unhealthy' | 'degraded';
  message?: string;
  responseTime?: number;
}

export interface HealthChecks {
  database: HealthCheckResult;
  storage: HealthCheckResult;
  payments: HealthCheckResult;
}

export interface SystemMetrics {
  total_transactions: number;
  active_sellers: number;
  held_volume: number;
  released_volume: number;
  pending_disputes: number;
  payouts_pending: number;
}

/**
 * HealthChecker class for performing system health checks
 */
export class HealthChecker {
  constructor(
    private db: D1Database,
    private r2: CompatibleR2Bucket,
    private midtransApiUrl: string,
    private midtransServerKey: string
  ) {}

  /**
   * Check database connectivity with a simple query
   */
  async checkDatabase(): Promise<HealthCheckResult> {
    const startTime = Date.now();

    try {
      // Simple query to check D1 connectivity
      const result = await this.db.prepare('SELECT 1 as test').first();

      if (result && result.test === 1) {
        return {
          status: 'healthy',
          responseTime: Date.now() - startTime,
        };
      }

      return {
        status: 'unhealthy',
        message: 'Database query returned unexpected result',
        responseTime: Date.now() - startTime,
      };
    } catch (error) {
      return {
        status: 'unhealthy',
        message: error instanceof Error ? error.message : 'Unknown database error',
        responseTime: Date.now() - startTime,
      };
    }
  }

  /**
   * Check R2 storage availability
   */
  async checkStorage(): Promise<HealthCheckResult> {
    const startTime = Date.now();

    try {
      // Try to list a small number of objects to check R2 connectivity
      // This is more reliable than head() on a specific key that might not exist
      const result = await this.r2.list({ limit: 1 });

      return {
        status: 'healthy',
        responseTime: Date.now() - startTime,
      };
    } catch (error) {
      return {
        status: 'unhealthy',
        message: error instanceof Error ? error.message : 'Unknown storage error',
        responseTime: Date.now() - startTime,
      };
    }
  }

  /**
   * Check Midtrans API status with timeout
   */
  async checkPayments(): Promise<HealthCheckResult> {
    const startTime = Date.now();
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(new Error('Payment gateway timeout')), 5000);

    try {
      // Create auth header for Midtrans
      const authHeader = `Basic ${btoa(`${this.midtransServerKey}:`)}`;

      // Try to ping Midtrans API (use a simple status check)
      // We'll check the SNAP API which should be available
      await fetch(`${this.midtransApiUrl}/v2`, {
        method: 'GET',
        headers: {
          Authorization: authHeader,
          Accept: 'application/json',
        },
        signal: controller.signal,
      });

      // Midtrans API may return 404 for /v2 endpoint, but that means it's reachable
      // We consider any response (including 404) as healthy, as long as we get a response
      return {
        status: 'healthy',
        responseTime: Date.now() - startTime,
      };
    } catch (error) {
      // If timeout or network error, consider it degraded rather than unhealthy
      // This allows the system to continue functioning even if payment gateway is temporarily down
      return {
        status: 'degraded',
        message: error instanceof Error ? error.message : 'Payment gateway unavailable',
        responseTime: Date.now() - startTime,
      };
    } finally {
      clearTimeout(timeoutId);
    }
  }

  /**
   * Perform all health checks
   */
  async performAllChecks(): Promise<HealthChecks> {
    const [database, storage, payments] = await Promise.all([
      this.checkDatabase(),
      this.checkStorage(),
      this.checkPayments(),
    ]);

    return {
      database,
      storage,
      payments,
    };
  }

  /**
   * Get overall system health status
   */
  getOverallStatus(checks: HealthChecks): 'healthy' | 'degraded' | 'unhealthy' {
    const hasUnhealthy = Object.values(checks).some(
      (check) => check.status === 'unhealthy'
    );
    const hasDegraded = Object.values(checks).some(
      (check) => check.status === 'degraded'
    );

    if (hasUnhealthy) {
      return 'unhealthy';
    }

    if (hasDegraded) {
      return 'degraded';
    }

    return 'healthy';
  }
}

/**
 * MetricsCollector class for gathering platform metrics
 */
export class MetricsCollector {
  private cache: {
    data: SystemMetrics | null;
    timestamp: number;
  } = {
    data: null,
    timestamp: 0,
  };

  private readonly CACHE_TTL = 60000; // 60 seconds

  constructor(private db: D1Database) {}

  /**
   * Collect all platform metrics from the database
   */
  async collectMetrics(): Promise<SystemMetrics> {
    // Check cache
    const now = Date.now();
    if (this.cache.data && (now - this.cache.timestamp) < this.CACHE_TTL) {
      return this.cache.data;
    }

    try {
      // Collect metrics in parallel for better performance
      const [
        totalTransactionsResult,
        activeSellersResult,
        heldVolumeResult,
        releasedVolumeResult,
        pendingDisputesResult,
        payoutsPendingResult,
      ] = await Promise.all([
        // Total transactions count
        this.db
          .prepare('SELECT COUNT(*) as count FROM transactions')
          .first<{ count: number }>(),

        // Active sellers (with at least one transaction)
        this.db
          .prepare(
            'SELECT COUNT(DISTINCT seller_id) as count FROM transactions WHERE status != ?'
          )
          .bind('pending')
          .first<{ count: number }>(),

        // Total held volume (sum of amounts in held/releasable state)
        this.db
          .prepare(
            'SELECT SUM(CAST(amount as INTEGER)) as total FROM transactions WHERE status IN (?, ?)'
          )
          .bind('held', 'releasable')
          .first<{ total: number }>(),

        // Total released volume (sum of amounts in released/completed state)
        this.db
          .prepare(
            'SELECT SUM(CAST(amount as INTEGER)) as total FROM transactions WHERE status IN (?, ?)'
          )
          .bind('released', 'completed')
          .first<{ total: number }>(),

        // Pending disputes
        this.db
          .prepare('SELECT COUNT(*) as count FROM disputes WHERE status = ?')
          .bind('pending')
          .first<{ count: number }>(),

        // Pending payouts
        this.db
          .prepare(
            'SELECT COUNT(*) as count FROM payouts WHERE status IN (?, ?)'
          )
          .bind('pending', 'processing')
          .first<{ count: number }>(),
      ]);

      const metrics: SystemMetrics = {
        total_transactions: totalTransactionsResult?.count || 0,
        active_sellers: activeSellersResult?.count || 0,
        held_volume: heldVolumeResult?.total || 0,
        released_volume: releasedVolumeResult?.total || 0,
        pending_disputes: pendingDisputesResult?.count || 0,
        payouts_pending: payoutsPendingResult?.count || 0,
      };

      // Update cache
      this.cache = {
        data: metrics,
        timestamp: now,
      };

      return metrics;
    } catch (error) {
      console.error('Error collecting metrics:', error);
      // Return empty metrics on error
      return {
        total_transactions: 0,
        active_sellers: 0,
        held_volume: 0,
        released_volume: 0,
        pending_disputes: 0,
        payouts_pending: 0,
      };
    }
  }

  /**
   * Clear the metrics cache
   */
  clearCache(): void {
    this.cache = {
      data: null,
      timestamp: 0,
    };
  }

  /**
   * Get cache age in seconds
   */
  getCacheAge(): number {
    if (!this.cache.data) {
      return 0;
    }
    return Math.floor((Date.now() - this.cache.timestamp) / 1000);
  }
}
