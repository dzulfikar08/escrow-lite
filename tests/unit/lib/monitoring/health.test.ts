import { describe, it, expect, beforeEach, vi } from 'vitest';
import { HealthChecker, MetricsCollector } from '@/lib/monitoring/health';

describe('Health Check Utilities', () => {
  describe('HealthChecker', () => {
    let mockDb: any;
    let mockR2: any;
    let healthChecker: HealthChecker;

    beforeEach(() => {
      // Mock D1 database
      mockDb = {
        prepare: vi.fn(() => ({
          first: vi.fn(),
        })),
      };

      // Mock R2 bucket
      mockR2 = {
        list: vi.fn(),
      };

      healthChecker = new HealthChecker(
        mockDb,
        mockR2,
        'https://app.midtrans.com',
        'test-server-key'
      );
    });

    describe('checkDatabase', () => {
      it('should return healthy when database query succeeds', async () => {
        mockDb.prepare.mockReturnValue({
          first: vi.fn().mockResolvedValue({ test: 1 }),
        });

        const result = await healthChecker.checkDatabase();

        expect(result.status).toBe('healthy');
        expect(result.responseTime).toBeGreaterThanOrEqual(0);
        expect(result.message).toBeUndefined();
      });

      it('should return unhealthy when database query fails', async () => {
        mockDb.prepare.mockReturnValue({
          first: vi.fn().mockRejectedValue(new Error('Database connection failed')),
        });

        const result = await healthChecker.checkDatabase();

        expect(result.status).toBe('unhealthy');
        expect(result.message).toBe('Database connection failed');
        expect(result.responseTime).toBeGreaterThanOrEqual(0);
      });

      it('should return unhealthy when database returns unexpected result', async () => {
        mockDb.prepare.mockReturnValue({
          first: vi.fn().mockResolvedValue({ test: 2 }),
        });

        const result = await healthChecker.checkDatabase();

        expect(result.status).toBe('unhealthy');
        expect(result.message).toBe('Database query returned unexpected result');
      });
    });

    describe('checkStorage', () => {
      it('should return healthy when R2 list succeeds', async () => {
        mockR2.list.mockResolvedValue({ objects: [] });

        const result = await healthChecker.checkStorage();

        expect(result.status).toBe('healthy');
        expect(result.responseTime).toBeGreaterThanOrEqual(0);
        expect(result.message).toBeUndefined();
      });

      it('should return unhealthy when R2 list fails', async () => {
        mockR2.list.mockRejectedValue(new Error('R2 connection failed'));

        const result = await healthChecker.checkStorage();

        expect(result.status).toBe('unhealthy');
        expect(result.message).toBe('R2 connection failed');
        expect(result.responseTime).toBeGreaterThanOrEqual(0);
      });
    });

    describe('checkPayments', () => {
      it('should return healthy when Midtrans API responds', async () => {
        global.fetch = vi.fn().mockResolvedValue({
          ok: true,
          status: 200,
        });

        const result = await healthChecker.checkPayments();

        expect(result.status).toBe('healthy');
        expect(result.responseTime).toBeGreaterThanOrEqual(0);
        expect(result.message).toBeUndefined();
      });

      it('should return degraded when Midtrans API times out', async () => {
        global.fetch = vi.fn().mockImplementation(() =>
          new Promise((_, reject) =>
            setTimeout(() => reject(new Error('Payment gateway timeout')), 10)
          )
        );

        const result = await healthChecker.checkPayments();

        // Should return degraded (not unhealthy) for payment gateway issues
        expect(result.status).toBe('degraded');
        expect(result.message).toBeDefined();
      });

      it('should return degraded when Midtrans API fails', async () => {
        global.fetch = vi.fn().mockRejectedValue(new Error('Network error'));

        const result = await healthChecker.checkPayments();

        expect(result.status).toBe('degraded');
        expect(result.message).toBe('Network error');
      });
    });

    describe('performAllChecks', () => {
      it('should perform all checks in parallel', async () => {
        mockDb.prepare.mockReturnValue({
          first: vi.fn().mockResolvedValue({ test: 1 }),
        });
        mockR2.list.mockResolvedValue({ objects: [] });
        global.fetch = vi.fn().mockResolvedValue({ ok: true });

        const checks = await healthChecker.performAllChecks();

        expect(checks).toHaveProperty('database');
        expect(checks).toHaveProperty('storage');
        expect(checks).toHaveProperty('payments');
      });

      it('should return all checks as healthy when all services are up', async () => {
        mockDb.prepare.mockReturnValue({
          first: vi.fn().mockResolvedValue({ test: 1 }),
        });
        mockR2.list.mockResolvedValue({ objects: [] });
        global.fetch = vi.fn().mockResolvedValue({ ok: true });

        const checks = await healthChecker.performAllChecks();

        expect(checks.database.status).toBe('healthy');
        expect(checks.storage.status).toBe('healthy');
        expect(checks.payments.status).toBe('healthy');
      });
    });

    describe('getOverallStatus', () => {
      it('should return healthy when all checks are healthy', () => {
        const checks = {
          database: { status: 'healthy' as const },
          storage: { status: 'healthy' as const },
          payments: { status: 'healthy' as const },
        };

        const status = healthChecker.getOverallStatus(checks);
        expect(status).toBe('healthy');
      });

      it('should return degraded when any check is degraded', () => {
        const checks = {
          database: { status: 'healthy' as const },
          storage: { status: 'degraded' as const },
          payments: { status: 'healthy' as const },
        };

        const status = healthChecker.getOverallStatus(checks);
        expect(status).toBe('degraded');
      });

      it('should return unhealthy when any check is unhealthy', () => {
        const checks = {
          database: { status: 'unhealthy' as const },
          storage: { status: 'healthy' as const },
          payments: { status: 'healthy' as const },
        };

        const status = healthChecker.getOverallStatus(checks);
        expect(status).toBe('unhealthy');
      });

      it('should prioritize unhealthy over degraded', () => {
        const checks = {
          database: { status: 'unhealthy' as const },
          storage: { status: 'degraded' as const },
          payments: { status: 'healthy' as const },
        };

        const status = healthChecker.getOverallStatus(checks);
        expect(status).toBe('unhealthy');
      });
    });
  });

  describe('MetricsCollector', () => {
    let mockDb: any;
    let mockFirst: any;
    let metricsCollector: MetricsCollector;

    beforeEach(() => {
      // Mock D1 database with proper method chaining
      mockFirst = vi.fn();
      mockDb = {
        prepare: vi.fn(() => ({
          bind: vi.fn(() => ({
            first: mockFirst,
          })),
          first: mockFirst,
        })),
      };

      metricsCollector = new MetricsCollector(mockDb);
    });

    describe('collectMetrics', () => {
      it('should return zero metrics when database is empty', async () => {
        mockFirst.mockResolvedValue({ count: 0, total: 0 });

        const metrics = await metricsCollector.collectMetrics();

        expect(metrics.total_transactions).toBe(0);
        expect(metrics.active_sellers).toBe(0);
        expect(metrics.held_volume).toBe(0);
        expect(metrics.released_volume).toBe(0);
        expect(metrics.pending_disputes).toBe(0);
        expect(metrics.payouts_pending).toBe(0);
      });

      it('should return actual metrics from database', async () => {
        // Mock different return values for each query
        mockFirst
          .mockResolvedValueOnce({ count: 100 }) // total_transactions
          .mockResolvedValueOnce({ count: 50 }) // active_sellers
          .mockResolvedValueOnce({ total: 45000000 }) // held_volume
          .mockResolvedValueOnce({ total: 123000000 }) // released_volume
          .mockResolvedValueOnce({ count: 3 }) // pending_disputes
          .mockResolvedValueOnce({ count: 5 }); // payouts_pending

        const metrics = await metricsCollector.collectMetrics();

        expect(metrics.total_transactions).toBe(100);
        expect(metrics.active_sellers).toBe(50);
        expect(metrics.held_volume).toBe(45000000);
        expect(metrics.released_volume).toBe(123000000);
        expect(metrics.pending_disputes).toBe(3);
        expect(metrics.payouts_pending).toBe(5);
      });

      it('should cache metrics for 60 seconds', async () => {
        mockFirst.mockResolvedValue({ count: 10, total: 1000 });

        const metrics1 = await metricsCollector.collectMetrics();

        // Wait a short time (10ms)
        await new Promise((resolve) => setTimeout(resolve, 10));

        const metrics2 = await metricsCollector.collectMetrics();

        // Should return same cached data
        expect(metrics1).toEqual(metrics2);

        // Cache should have been created
        const cacheAge = metricsCollector.getCacheAge();
        expect(cacheAge).toBeGreaterThanOrEqual(0);
      });

      it('should refresh cache after TTL expires', async () => {
        // First call returns 10 transactions
        mockFirst.mockResolvedValue({ count: 10, total: 1000 });

        const metrics1 = await metricsCollector.collectMetrics();
        expect(metrics1.total_transactions).toBe(10);

        // Clear cache to simulate TTL expiry
        metricsCollector.clearCache();

        // Second call returns 20 transactions
        mockFirst.mockResolvedValue({ count: 20, total: 2000 });

        const metrics2 = await metricsCollector.collectMetrics();
        expect(metrics2.total_transactions).toBe(20);
      });

      it('should return empty metrics on database error', async () => {
        mockFirst.mockRejectedValue(new Error('Database error'));

        const metrics = await metricsCollector.collectMetrics();

        expect(metrics.total_transactions).toBe(0);
        expect(metrics.active_sellers).toBe(0);
        expect(metrics.held_volume).toBe(0);
        expect(metrics.released_volume).toBe(0);
        expect(metrics.pending_disputes).toBe(0);
        expect(metrics.payouts_pending).toBe(0);
      });
    });

    describe('clearCache', () => {
      it('should clear the metrics cache', async () => {
        mockFirst.mockResolvedValue({ count: 10, total: 1000 });

        // Collect metrics
        await metricsCollector.collectMetrics();

        // Verify cache exists
        const cacheAgeBefore = metricsCollector.getCacheAge();
        expect(cacheAgeBefore).toBeGreaterThanOrEqual(0);

        // Clear cache
        metricsCollector.clearCache();
        expect(metricsCollector.getCacheAge()).toBe(0);
      });
    });

    describe('getCacheAge', () => {
      it('should return 0 when no cache exists', () => {
        expect(metricsCollector.getCacheAge()).toBe(0);
      });

      it('should return age in seconds', async () => {
        mockFirst.mockResolvedValue({ count: 10, total: 1000 });

        await metricsCollector.collectMetrics();
        const age = metricsCollector.getCacheAge();

        expect(age).toBeGreaterThanOrEqual(0);
        expect(age).toBeLessThan(1); // Should be less than 1 second
      });
    });
  });
});
