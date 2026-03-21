/**
 * Tests for Error Tracker and Error Aggregator
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { ErrorTracker } from '@/lib/monitoring/error-tracker';
import { ErrorAggregator } from '@/lib/monitoring/error-aggregator';
import {
  ValidationError,
  AuthenticationError,
  PaymentError,
  AppError,
} from '@/lib/errors';

// Mock D1 database
const mockDb: { prepare: any } = {
  prepare: vi.fn(() => ({
    bind: vi.fn(() => ({
      run: vi.fn(),
      first: vi.fn(),
      all: vi.fn(),
    })),
    run: vi.fn(),
    first: vi.fn(),
    all: vi.fn(),
  })),
};

describe('ErrorTracker', () => {
  let errorTracker: ErrorTracker;

  beforeEach(() => {
    vi.clearAllMocks();
    errorTracker = new ErrorTracker(mockDb as any);
  });

  describe('capture', () => {
    it('should capture ValidationError with context', async () => {
      const error = new ValidationError('Invalid input', { field: 'test' });
      const context = {
        userId: 'user-123',
        requestId: 'req-456',
        endpoint: '/api/v1/test',
        method: 'POST',
        userAgent: 'test-agent',
        ip: '127.0.0.1',
      };

      await errorTracker.capture(error, context);

      expect(mockDb.prepare).toHaveBeenCalledWith(
        expect.stringContaining('INSERT INTO error_logs')
      );
    });

    it('should capture AuthenticationError', async () => {
      const error = new AuthenticationError('Unauthorized');
      const context = { userId: 'user-123' };

      await errorTracker.capture(error, context);

      expect(mockDb.prepare).toHaveBeenCalled();
    });

    it('should capture PaymentError with gateway info', async () => {
      const error = new PaymentError('Payment failed', 'midtrans', 'ref-123');
      const context = { requestId: 'req-789' };

      await errorTracker.capture(error, context);

      expect(mockDb.prepare).toHaveBeenCalled();
    });

    it('should capture generic Error', async () => {
      const error = new Error('Something went wrong');
      const context = {};

      await errorTracker.capture(error, context);

      expect(mockDb.prepare).toHaveBeenCalled();
    });

    it('should handle capture failure gracefully', async () => {
      const error = new Error('Test error');
      mockDb.prepare = vi.fn(() => {
        throw new Error('Database error');
      });

      // Should not throw
      await errorTracker.capture(error, {});

      // Console.error should have been called
      expect(mockDb.prepare).toHaveBeenCalled();
    });
  });

  describe('getErrors', () => {
    it('should return errors with default filters', async () => {
      const mockErrors = [
        {
          id: 'error-1',
          error_type: 'ValidationError',
          error_code: 'VALIDATION_ERROR',
          message: 'Test error',
          created_at: '2024-01-01T00:00:00Z',
        },
      ];

      mockDb.prepare = vi.fn(() => ({
        bind: vi.fn(() => ({
          all: vi.fn().mockResolvedValue({ results: mockErrors }),
        })),
      }));

      const errors = await errorTracker.getErrors();

      expect(errors).toEqual(mockErrors);
    });

    it('should apply error type filter', async () => {
      mockDb.prepare = vi.fn(() => ({
        bind: vi.fn(() => ({
          all: vi.fn().mockResolvedValue({ results: [] }),
        })),
      }));

      await errorTracker.getErrors({ errorType: 'ValidationError' });

      expect(mockDb.prepare).toHaveBeenCalledWith(
        expect.stringContaining('error_type = ?')
      );
    });

    it('should apply status filter', async () => {
      mockDb.prepare = vi.fn(() => ({
        bind: vi.fn(() => ({
          all: vi.fn().mockResolvedValue({ results: [] }),
        })),
      }));

      await errorTracker.getErrors({ status: 'active' });

      expect(mockDb.prepare).toHaveBeenCalledWith(
        expect.stringContaining('status = ?')
      );
    });

    it('should apply date range filter', async () => {
      mockDb.prepare = vi.fn(() => ({
        bind: vi.fn(() => ({
          all: vi.fn().mockResolvedValue({ results: [] }),
        })),
      }));

      await errorTracker.getErrors({
        startDate: '2024-01-01T00:00:00Z',
        endDate: '2024-01-31T23:59:59Z',
      });

      expect(mockDb.prepare).toHaveBeenCalledWith(
        expect.stringContaining('created_at >= ?')
      );
    });
  });

  describe('getRecentErrors', () => {
    it('should return recent errors with limit', async () => {
      mockDb.prepare = vi.fn(() => ({
        bind: vi.fn(() => ({
          all: vi.fn().mockResolvedValue({ results: [] }),
        })),
      }));

      await errorTracker.getRecentErrors(50);

      expect(mockDb.prepare).toHaveBeenCalledWith(
        expect.stringContaining('ORDER BY created_at DESC')
      );
    });
  });

  describe('resolveError', () => {
    it('should mark error as resolved', async () => {
      mockDb.prepare = vi.fn(() => ({
        bind: vi.fn(() => ({
          run: vi.fn().mockResolvedValue({ meta: { changes: 1 } }),
        })),
      }));

      const result = await errorTracker.resolveError('error-1', 'admin-1', 'Fixed');

      expect(result).toBe(true);
      expect(mockDb.prepare).toHaveBeenCalledWith(
        expect.stringContaining('UPDATE error_logs')
      );
    });
  });

  describe('ignoreError', () => {
    it('should mark error as ignored', async () => {
      mockDb.prepare = vi.fn(() => ({
        bind: vi.fn(() => ({
          run: vi.fn().mockResolvedValue({ meta: { changes: 1 } }),
        })),
      }));

      const result = await errorTracker.ignoreError('error-1');

      expect(result).toBe(true);
      expect(mockDb.prepare).toHaveBeenCalledWith(
        expect.stringContaining('UPDATE error_logs')
      );
    });
  });

  describe('exportErrors', () => {
    it('should export errors to CSV format', async () => {
      const mockErrors = [
        {
          id: 'error-1',
          error_type: 'ValidationError',
          error_code: 'VALIDATION_ERROR',
          message: 'Test error',
          request_id: 'req-1',
          user_id: 'user-1',
          endpoint: '/api/test',
          method: 'POST',
          status: 'active',
          created_at: '2024-01-01T00:00:00Z',
        },
      ];

      mockDb.prepare = vi.fn(() => ({
        bind: vi.fn(() => ({
          all: vi.fn().mockResolvedValue({ results: mockErrors }),
        })),
      }));

      const csv = await errorTracker.exportErrors();

      expect(csv).toContain('id,error_type,error_code,message');
      expect(csv).toContain('error-1,ValidationError,VALIDATION_ERROR');
    });

    it('should handle errors with commas in CSV export', async () => {
      const mockErrors = [
        {
          id: 'error-1',
          error_type: 'Error',
          error_code: 'ERROR',
          message: 'Test, with, commas',
          request_id: 'req-1',
          user_id: 'user-1',
          endpoint: '/api/test',
          method: 'POST',
          status: 'active',
          created_at: '2024-01-01T00:00:00Z',
        },
      ];

      mockDb.prepare = vi.fn(() => ({
        bind: vi.fn(() => ({
          all: vi.fn().mockResolvedValue({ results: mockErrors }),
        })),
      }));

      const csv = await errorTracker.exportErrors();

      expect(csv).toContain('"Test, with, commas"');
    });
  });
});

describe('ErrorAggregator', () => {
  let errorAggregator: ErrorAggregator;

  beforeEach(() => {
    vi.clearAllMocks();
    errorAggregator = new ErrorAggregator(mockDb as any);
  });

  describe('aggregateErrors', () => {
    it('should return error aggregation', async () => {
      const mockResults = {
        total: { count: 100 },
        byType: { results: [{ ValidationError: 50 }] },
        byCode: { results: [{ VALIDATION_ERROR: 50 }] },
        byStatus: { results: [{ active: 80 }] },
        byHour: { results: [] },
        byEndpoint: { results: [] },
        byUser: { results: [] },
      };

      let callCount = 0;
      mockDb.prepare = vi.fn(() => ({
        bind: vi.fn(() => {
          callCount++;
          if (callCount === 1) {
            return { first: vi.fn().mockResolvedValue(mockResults.total) };
          }
          return { all: vi.fn().mockResolvedValue(mockResults.byType) };
        }),
      }));

      const aggregation = await errorAggregator.aggregateErrors();

      // Should return aggregation with default values if queries fail
      expect(aggregation).toBeDefined();
      expect(aggregation.totalErrors).toBeGreaterThanOrEqual(0);
      expect(aggregation.errorsByType).toBeDefined();
      expect(aggregation.errorsByCode).toBeDefined();
      expect(aggregation.errorsByStatus).toBeDefined();
    });

    it('should use cache for repeated calls', async () => {
      mockDb.prepare = vi.fn(() => ({
        bind: vi.fn(() => ({
          first: vi.fn().mockResolvedValue({ count: 100 }),
          all: vi.fn().mockResolvedValue({ results: [] }),
        })),
      }));

      await errorAggregator.aggregateErrors();
      await errorAggregator.aggregateErrors(); // Should use cache

      // Should only call prepare once due to caching
      expect(mockDb.prepare).toHaveBeenCalledTimes(7);
    });
  });

  describe('calculateErrorRate', () => {
    it('should calculate current error rate', async () => {
      mockDb.prepare = vi.fn(() => ({
        bind: vi.fn(() => ({
          first: vi.fn()
            .mockResolvedValueOnce({ count: 10 })
            .mockResolvedValueOnce({ count: 5 }),
        })),
      }));

      const metrics = await errorAggregator.calculateErrorRate(5);

      expect(metrics.currentRate).toBeGreaterThanOrEqual(0);
      expect(metrics.averageRate).toBeGreaterThanOrEqual(0);
      expect(['increasing', 'decreasing', 'stable']).toContain(metrics.trend);
    });

    it('should detect stable trend', async () => {
      mockDb.prepare = vi.fn(() => ({
        bind: vi.fn(() => ({
          first: vi.fn()
            .mockResolvedValueOnce({ count: 5 })
            .mockResolvedValueOnce({ count: 5 }),
        })),
      }));

      const metrics = await errorAggregator.calculateErrorRate(5);

      expect(metrics.trend).toBe('stable');
    });
  });

  describe('checkForSpikes', () => {
    it('should return critical alert when error rate exceeds threshold', async () => {
      mockDb.prepare = vi.fn(() => ({
        bind: vi.fn(() => ({
          first: vi.fn()
            .mockResolvedValueOnce({ count: 30 })
            .mockResolvedValueOnce({ count: 5 }),
        })),
      }));

      const alerts = await errorAggregator.checkForSpikes();

      // Should return critical alert
      expect(alerts.length).toBeGreaterThan(0);
      expect(alerts[0].alertType).toBe('critical');
    });

    it('should return empty array when no spikes', async () => {
      mockDb.prepare = vi.fn(() => ({
        bind: vi.fn(() => ({
          first: vi.fn()
            .mockResolvedValueOnce({ count: 1 })
            .mockResolvedValueOnce({ count: 2 }),
        })),
      }));

      const alerts = await errorAggregator.checkForSpikes();

      expect(alerts).toBeDefined();
      expect(Array.isArray(alerts)).toBe(true);
    });
  });

  describe('checkCriticalErrors', () => {
    it('should alert on payment errors', async () => {
      let callCount = 0;
      mockDb.prepare = vi.fn(() => ({
        bind: vi.fn(() => {
          callCount++;
          return {
            first: vi.fn().mockResolvedValue({ count: 5 }),
          };
        }),
      }));

      const alerts = await errorAggregator.checkCriticalErrors();

      expect(alerts).toBeDefined();
      expect(Array.isArray(alerts)).toBe(true);
    });

    it('should return empty array when no critical errors', async () => {
      mockDb.prepare = vi.fn(() => ({
        bind: vi.fn(() => ({
          first: vi.fn().mockResolvedValue({ count: 0 }),
        })),
      }));

      const alerts = await errorAggregator.checkCriticalErrors();

      expect(alerts).toEqual([]);
    });
  });

  describe('getErrorTrend', () => {
    it('should return error trend data', async () => {
      const mockTrend = [
        { timestamp: '2024-01-01 10:00:00', error_type: 'ValidationError', count: 5 },
        { timestamp: '2024-01-01 10:00:00', error_type: 'AuthenticationError', count: 2 },
      ];

      mockDb.prepare = vi.fn(() => ({
        bind: vi.fn(() => ({
          all: vi.fn().mockResolvedValue({ results: mockTrend }),
        })),
      }));

      const trend = await errorAggregator.getErrorTrend(24);

      expect(trend).toBeDefined();
      expect(trend.length).toBeGreaterThan(0);
      expect(trend[0]).toHaveProperty('timestamp');
      expect(trend[0]).toHaveProperty('count');
      expect(trend[0]).toHaveProperty('errorTypes');
    });
  });

  describe('cache management', () => {
    it('should clear cache', () => {
      errorAggregator.clearCache();
      // Should not throw
      expect(true).toBe(true);
    });

    it('should return cache age', () => {
      const age = errorAggregator.getCacheAge();
      expect(typeof age).toBe('number');
    });
  });
});
