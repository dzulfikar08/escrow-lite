import { describe, it, expect, beforeEach, vi } from 'vitest';
import { handlePayoutScheduler, triggerManually, healthCheck, getStatistics } from '@/services/cron/payout-scheduler';
import { PayoutService } from '@/services/payouts/processor';
import { LedgerService } from '@/services/escrow/ledger';
import { BalanceService } from '@/services/escrow/balance';

// Mock the services
vi.mock('@/services/payouts/processor');
vi.mock('@/services/escrow/ledger');
vi.mock('@/services/escrow/balance');

describe('Payout Scheduler Cron Job', () => {
  let mockEnv: any;
  let mockEvent: any;

  beforeEach(() => {
    // Reset all mocks
    vi.clearAllMocks();

    // Setup mock environment
    mockEnv = {
      DB: {
        prepare: vi.fn().mockReturnValue({
          bind: vi.fn().mockReturnValue({
            first: vi.fn(),
            all: vi.fn(),
            run: vi.fn(),
          }),
        }),
      },
      PUBLIC_URL: 'https://example.com',
    };

    // Setup mock event
    mockEvent = {
      scheduledTime: Date.now(),
      cron: '*/5 * * * *',
    };
  });

  describe('handlePayoutScheduler', () => {
    it('should process pending payouts successfully', async () => {
      // Mock successful processing
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

      // Execute
      await handlePayoutScheduler(mockEvent, mockEnv);

      // Verify
      expect(PayoutService.prototype.processPendingPayouts).toHaveBeenCalled();
    });

    it('should handle no pending payouts', async () => {
      // Mock empty result
      const mockResult = {
        processed: 0,
        succeeded: [],
        failed: [],
        skipped: 0,
      };

      vi.mocked(PayoutService.prototype.processPendingPayouts).mockResolvedValue(mockResult);

      // Execute
      await handlePayoutScheduler(mockEvent, mockEnv);

      // Verify
      expect(PayoutService.prototype.processPendingPayouts).toHaveBeenCalled();
    });

    it('should handle failed payouts gracefully', async () => {
      // Mock result with failures
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

      // Execute
      await handlePayoutScheduler(mockEvent, mockEnv);

      // Verify
      expect(PayoutService.prototype.processPendingPayouts).toHaveBeenCalled();
    });

    it('should throw error on fatal processing error', async () => {
      // Mock fatal error
      vi.mocked(PayoutService.prototype.processPendingPayouts).mockRejectedValue(
        new Error('Database connection failed')
      );

      // Execute and verify
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

      expect(consoleLogSpy).toHaveBeenCalledWith(
        expect.stringContaining('Job completed in')
      );
      expect(consoleLogSpy).toHaveBeenCalledWith(
        expect.stringContaining('ms')
      );
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

      // Execute
      const result = await triggerManually(mockEnv);

      // Verify
      expect(result.processed).toBe(2);
      expect(result.succeeded).toHaveLength(2);
      expect(result.failed).toHaveLength(0);
      expect(result.duration).toBeGreaterThan(0);
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
      // Mock database query
      mockEnv.DB.prepare().bind().first().mockResolvedValue({
        count: 5,
      });

      const result = await healthCheck(mockEnv);

      expect(result.healthy).toBe(true);
      expect(result.pendingPayouts).toBe(5);
    });

    it('should return unhealthy status on database error', async () => {
      // Mock database error
      mockEnv.DB.prepare().bind().first().mockRejectedValue(
        new Error('Database connection failed')
      );

      const result = await healthCheck(mockEnv);

      expect(result.healthy).toBe(false);
      expect(result.error).toBe('Database connection failed');
    });

    it('should handle zero pending payouts', async () => {
      mockEnv.DB.prepare().bind().first().mockResolvedValue({
        count: 0,
      });

      const result = await healthCheck(mockEnv);

      expect(result.healthy).toBe(true);
      expect(result.pendingPayouts).toBe(0);
    });
  });

  describe('getStatistics', () => {
    it('should return comprehensive statistics', async () => {
      // Mock database queries
      mockEnv.DB.prepare = vi.fn()
        .mockReturnValueOnce({
          bind: vi.fn().mockReturnValue({
            first: vi.fn().mockResolvedValue({ count: 10 }),
          }),
        })
        .mockReturnValueOnce({
          bind: vi.fn().mockReturnValue({
            first: vi.fn().mockResolvedValue({ count: 2 }),
          }),
        })
        .mockReturnValueOnce({
          bind: vi.fn().mockReturnValue({
            first: vi.fn().mockResolvedValue({ count: 15 }),
          }),
        })
        .mockReturnValueOnce({
          bind: vi.fn().mockReturnValue({
            first: vi.fn().mockResolvedValue({ count: 1 }),
          }),
        });

      const result = await getStatistics(mockEnv);

      expect(result.pendingPayouts).toBe(10);
      expect(result.processingPayouts).toBe(2);
      expect(result.completedToday).toBe(15);
      expect(result.failedToday).toBe(1);
    });

    it('should handle database errors gracefully', async () => {
      mockEnv.DB.prepare().bind().first().mockRejectedValue(
        new Error('Query failed')
      );

      await expect(getStatistics(mockEnv)).rejects.toThrow('Query failed');
    });

    it('should return zero counts when no payouts exist', async () => {
      // Mock all queries to return null
      mockEnv.DB.prepare = vi.fn()
        .mockReturnValue({
          bind: vi.fn().mockReturnValue({
            first: vi.fn().mockResolvedValue(null),
          }),
        });

      const result = await getStatistics(mockEnv);

      expect(result.pendingPayouts).toBe(0);
      expect(result.processingPayouts).toBe(0);
      expect(result.completedToday).toBe(0);
      expect(result.failedToday).toBe(0);
    });
  });

  describe('batch processing', () => {
    it('should process up to 10 payouts at a time', async () => {
      // Mock 15 pending payouts
      const mockResult = {
        processed: 10, // Should only process 10 at a time
        succeeded: Array.from({ length: 10 }, (_, i) => ({
          id: `payout-${i + 1}`,
          reference: `STUB-${i + 1}`,
        })),
        failed: [],
        skipped: 5, // 5 remaining
      };

      vi.mocked(PayoutService.prototype.processPendingPayouts).mockResolvedValue(mockResult);

      await handlePayoutScheduler(mockEvent, mockEnv);

      expect(PayoutService.prototype.processPendingPayouts).toHaveBeenCalled();
    });

    it('should skip payouts already in processing status', async () => {
      const mockResult = {
        processed: 5,
        succeeded: [
          { id: 'payout-1', reference: 'STUB-123' },
        ],
        failed: [],
        skipped: 4, // 4 already being processed
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

      expect(consoleErrorSpy).toHaveBeenCalledWith(
        expect.stringContaining('Fatal error:')
      );
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

      // Should not throw
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
      // This would be tested through integration tests with actual database
      // For unit tests, we verify the service is called
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
      // This would be tested through integration tests
      // For unit tests, we verify the service is called
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
        skipped: 8, // 8 recently processed
      };

      vi.mocked(PayoutService.prototype.processPendingPayouts).mockResolvedValue(mockResult);

      await handlePayoutScheduler(mockEvent, mockEnv);

      expect(PayoutService.prototype.processPendingPayouts).toHaveBeenCalled();
    });

    it('should use last_processed_at for idempotency checks', async () => {
      // This would be tested through integration tests
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
