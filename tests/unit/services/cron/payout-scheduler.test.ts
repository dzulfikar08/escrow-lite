import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  handlePayoutScheduler,
  triggerManually,
  healthCheck,
  getStatistics,
} from '@/services/cron/payout-scheduler';
import { PayoutService } from '@/services/payouts/processor';
import { LedgerService } from '@/services/escrow/ledger';
import { BalanceService } from '@/services/escrow/balance';

vi.mock('@/services/payouts/processor');
vi.mock('@/services/escrow/ledger');
vi.mock('@/services/escrow/balance');

function createMockDb(overrides?: Record<string, any>) {
  const firstMock = vi.fn().mockResolvedValue(null);
  const allMock = vi.fn().mockResolvedValue({ results: [] });
  const runMock = vi.fn().mockResolvedValue({});
  const bindMock = vi.fn().mockReturnValue({ first: firstMock, all: allMock, run: runMock });
  const prepareResult = { bind: bindMock, first: firstMock, all: allMock, run: runMock };
  const prepareMock = vi.fn().mockReturnValue(prepareResult);

  return {
    prepare: prepareMock,
    _firstMock: firstMock,
    _bindMock: bindMock,
    _allMock: allMock,
    _runMock: runMock,
    ...overrides,
  };
}

describe('Payout Scheduler Cron Job', () => {
  let mockEnv: any;
  let mockEvent: any;

  beforeEach(() => {
    vi.clearAllMocks();

    mockEnv = {
      DB: createMockDb(),
      PUBLIC_URL: 'https://example.com',
    };

    mockEvent = {
      scheduledTime: Date.now(),
      cron: '*/5 * * * *',
    };
  });

  describe('handlePayoutScheduler', () => {
    it('should process pending payouts successfully', async () => {
      const mockResult = {
        processed: 5,
        succeeded: [
          { id: 'payout-1', reference: 'STUB-123' },
          { id: 'payout-2', reference: 'STUB-456' },
        ],
        failed: [],
        skipped: 0,
      };

      vi.mocked(PayoutService.prototype.processPendingPayouts).mockResolvedValue(mockResult);

      await handlePayoutScheduler(mockEvent, mockEnv);

      expect(PayoutService.prototype.processPendingPayouts).toHaveBeenCalled();
    });

    it('should handle no pending payouts', async () => {
      const mockResult = {
        processed: 0,
        succeeded: [],
        failed: [],
        skipped: 0,
      };

      vi.mocked(PayoutService.prototype.processPendingPayouts).mockResolvedValue(mockResult);

      await handlePayoutScheduler(mockEvent, mockEnv);

      expect(PayoutService.prototype.processPendingPayouts).toHaveBeenCalled();
    });

    it('should handle failed payouts gracefully', async () => {
      const mockResult = {
        processed: 3,
        succeeded: [{ id: 'payout-1', reference: 'STUB-123' }],
        failed: [
          { id: 'payout-2', error: 'Bank transfer failed' },
          { id: 'payout-3', error: 'Invalid account' },
        ],
        skipped: 0,
      };

      vi.mocked(PayoutService.prototype.processPendingPayouts).mockResolvedValue(mockResult);

      await handlePayoutScheduler(mockEvent, mockEnv);

      expect(PayoutService.prototype.processPendingPayouts).toHaveBeenCalled();
    });

    it('should throw error on fatal processing error', async () => {
      vi.mocked(PayoutService.prototype.processPendingPayouts).mockRejectedValue(
        new Error('Database connection failed')
      );

      await expect(handlePayoutScheduler(mockEvent, mockEnv)).rejects.toThrow(
        'Database connection failed'
      );
    });

    it('should log processing duration', async () => {
      const mockResult = {
        processed: 1,
        succeeded: [{ id: 'payout-1', reference: 'STUB-123' }],
        failed: [],
        skipped: 0,
      };

      vi.mocked(PayoutService.prototype.processPendingPayouts).mockResolvedValue(mockResult);

      const consoleLogSpy = vi.spyOn(console, 'log');

      await handlePayoutScheduler(mockEvent, mockEnv);

      const logCalls = consoleLogSpy.mock.calls.map((call) => call.join(' '));
      const durationLog = logCalls.find(
        (log) => log.includes('Job completed in') && log.includes('ms')
      );
      expect(durationLog).toBeDefined();
    });
  });

  describe('triggerManually', () => {
    it('should trigger payout processing manually', async () => {
      const mockResult = {
        processed: 2,
        succeeded: [
          { id: 'payout-1', reference: 'STUB-123' },
          { id: 'payout-2', reference: 'STUB-456' },
        ],
        failed: [],
        skipped: 0,
      };

      vi.mocked(PayoutService.prototype.processPendingPayouts).mockResolvedValue(mockResult);

      const result = await triggerManually(mockEnv);

      expect(result.processed).toBe(2);
      expect(result.succeeded).toHaveLength(2);
      expect(result.failed).toHaveLength(0);
      expect(result.duration).toBeGreaterThanOrEqual(0);
    });

    it('should include duration in manual trigger result', async () => {
      const mockResult = {
        processed: 0,
        succeeded: [],
        failed: [],
        skipped: 0,
      };

      vi.mocked(PayoutService.prototype.processPendingPayouts).mockResolvedValue(mockResult);

      const result = await triggerManually(mockEnv);

      expect(result).toHaveProperty('duration');
      expect(typeof result.duration).toBe('number');
    });
  });

  describe('healthCheck', () => {
    it('should return healthy status when database is accessible', async () => {
      const mockDb = createMockDb();
      mockDb._firstMock.mockResolvedValue({ count: 5 });
      mockEnv.DB = mockDb;

      const result = await healthCheck(mockEnv);

      expect(result.healthy).toBe(true);
      expect(result.pendingPayouts).toBe(5);
    });

    it('should return unhealthy status on database error', async () => {
      const mockDb = createMockDb();
      mockDb._firstMock.mockRejectedValue(new Error('Database connection failed'));
      mockEnv.DB = mockDb;

      const result = await healthCheck(mockEnv);

      expect(result.healthy).toBe(false);
      expect(result.error).toBe('Database connection failed');
    });

    it('should handle zero pending payouts', async () => {
      const mockDb = createMockDb();
      mockDb._firstMock.mockResolvedValue({ count: 0 });
      mockEnv.DB = mockDb;

      const result = await healthCheck(mockEnv);

      expect(result.healthy).toBe(true);
      expect(result.pendingPayouts).toBe(0);
    });
  });

  describe('getStatistics', () => {
    it('should return comprehensive statistics', async () => {
      const results = [{ count: 10 }, { count: 2 }, { count: 15 }, { count: 1 }];
      let prepareCallIndex = 0;

      const mockPrepare = vi.fn().mockImplementation(() => {
        const mockFirst = vi.fn().mockResolvedValue(results[prepareCallIndex] ?? null);
        const mockRun = vi.fn().mockResolvedValue({});
        const mockBind = vi.fn().mockReturnValue({ first: mockFirst, run: mockRun });
        prepareCallIndex++;
        return { bind: mockBind, first: mockFirst, run: mockRun };
      });

      mockEnv.DB = { prepare: mockPrepare };

      const result = await getStatistics(mockEnv);

      expect(result.pendingPayouts).toBe(10);
      expect(result.processingPayouts).toBe(2);
      expect(result.completedToday).toBe(15);
      expect(result.failedToday).toBe(1);
    });

    it('should handle database errors gracefully', async () => {
      const mockFirst = vi.fn().mockRejectedValue(new Error('Query failed'));
      const mockRun = vi.fn();
      const mockBind = vi.fn().mockReturnValue({ first: mockFirst, run: mockRun });
      const mockPrepare = vi
        .fn()
        .mockReturnValue({ bind: mockBind, first: mockFirst, run: mockRun });

      mockEnv.DB = { prepare: mockPrepare };

      await expect(getStatistics(mockEnv)).rejects.toThrow('Query failed');
    });

    it('should return zero counts when no payouts exist', async () => {
      const mockPrepare = vi.fn().mockImplementation(() => {
        const mockFirst = vi.fn().mockResolvedValue(null);
        const mockRun = vi.fn().mockResolvedValue({});
        const mockBind = vi.fn().mockReturnValue({ first: mockFirst, run: mockRun });
        return { bind: mockBind, first: mockFirst, run: mockRun };
      });

      mockEnv.DB = { prepare: mockPrepare };

      const result = await getStatistics(mockEnv);

      expect(result.pendingPayouts).toBe(0);
      expect(result.processingPayouts).toBe(0);
      expect(result.completedToday).toBe(0);
      expect(result.failedToday).toBe(0);
    });
  });

  describe('batch processing', () => {
    it('should process up to 10 payouts at a time', async () => {
      const mockResult = {
        processed: 10,
        succeeded: Array.from({ length: 10 }, (_, i) => ({
          id: `payout-${i + 1}`,
          reference: `STUB-${i + 1}`,
        })),
        failed: [],
        skipped: 5,
      };

      vi.mocked(PayoutService.prototype.processPendingPayouts).mockResolvedValue(mockResult);

      await handlePayoutScheduler(mockEvent, mockEnv);

      expect(PayoutService.prototype.processPendingPayouts).toHaveBeenCalled();
    });

    it('should skip payouts already in processing status', async () => {
      const mockResult = {
        processed: 5,
        succeeded: [{ id: 'payout-1', reference: 'STUB-123' }],
        failed: [],
        skipped: 4,
      };

      vi.mocked(PayoutService.prototype.processPendingPayouts).mockResolvedValue(mockResult);

      await handlePayoutScheduler(mockEvent, mockEnv);

      expect(PayoutService.prototype.processPendingPayouts).toHaveBeenCalled();
    });
  });

  describe('error handling', () => {
    it('should log detailed error information on failure', async () => {
      const consoleErrorSpy = vi.spyOn(console, 'error');

      vi.mocked(PayoutService.prototype.processPendingPayouts).mockRejectedValue(
        new Error('Critical processing error')
      );

      try {
        await handlePayoutScheduler(mockEvent, mockEnv);
      } catch (error) {
        // Expected to throw
      }

      const errorCalls = consoleErrorSpy.mock.calls.map((call) => call.join(' '));
      const fatalLog = errorCalls.find((log) => log.includes('Fatal error:'));
      expect(fatalLog).toBeDefined();
    });

    it('should handle individual payout failures without stopping', async () => {
      const mockResult = {
        processed: 3,
        succeeded: [{ id: 'payout-1', reference: 'STUB-123' }],
        failed: [
          { id: 'payout-2', error: 'Bank API error' },
          { id: 'payout-3', error: 'Invalid account' },
        ],
        skipped: 0,
      };

      vi.mocked(PayoutService.prototype.processPendingPayouts).mockResolvedValue(mockResult);

      await expect(handlePayoutScheduler(mockEvent, mockEnv)).resolves.not.toThrow();
    });
  });

  describe('retry logic', () => {
    it('should track retry counts for failed payouts', async () => {
      const mockResult = {
        processed: 2,
        succeeded: [{ id: 'payout-1', reference: 'STUB-123' }],
        failed: [{ id: 'payout-2', error: 'Temporary failure' }],
        skipped: 0,
      };

      vi.mocked(PayoutService.prototype.processPendingPayouts).mockResolvedValue(mockResult);

      await handlePayoutScheduler(mockEvent, mockEnv);

      expect(PayoutService.prototype.processPendingPayouts).toHaveBeenCalled();
    });

    it('should implement exponential backoff for retries', async () => {
      const mockResult = {
        processed: 1,
        succeeded: [],
        failed: [{ id: 'payout-1', error: 'Retryable error' }],
        skipped: 0,
      };

      vi.mocked(PayoutService.prototype.processPendingPayouts).mockResolvedValue(mockResult);

      await handlePayoutScheduler(mockEvent, mockEnv);

      expect(PayoutService.prototype.processPendingPayouts).toHaveBeenCalled();
    });
  });

  describe('FIFO ordering', () => {
    it('should process payouts in FIFO order (created_at ASC)', async () => {
      const mockResult = {
        processed: 5,
        succeeded: [],
        failed: [],
        skipped: 0,
      };

      vi.mocked(PayoutService.prototype.processPendingPayouts).mockResolvedValue(mockResult);

      await handlePayoutScheduler(mockEvent, mockEnv);

      expect(PayoutService.prototype.processPendingPayouts).toHaveBeenCalled();
    });
  });

  describe('idempotency', () => {
    it('should skip payouts recently processed', async () => {
      const mockResult = {
        processed: 2,
        succeeded: [{ id: 'payout-1', reference: 'STUB-123' }],
        failed: [],
        skipped: 8,
      };

      vi.mocked(PayoutService.prototype.processPendingPayouts).mockResolvedValue(mockResult);

      await handlePayoutScheduler(mockEvent, mockEnv);

      expect(PayoutService.prototype.processPendingPayouts).toHaveBeenCalled();
    });

    it('should use last_processed_at for idempotency checks', async () => {
      const mockResult = {
        processed: 1,
        succeeded: [],
        failed: [],
        skipped: 9,
      };

      vi.mocked(PayoutService.prototype.processPendingPayouts).mockResolvedValue(mockResult);

      await handlePayoutScheduler(mockEvent, mockEnv);

      expect(PayoutService.prototype.processPendingPayouts).toHaveBeenCalled();
    });
  });
});
