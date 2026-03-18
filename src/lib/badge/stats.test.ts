/**
 * Tests for Badge Stats Calculator
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  calculateSellerStats,
  formatBadgeStats,
  formatNumber,
  formatRupiah,
  formatDate,
  getSuccessRateColor,
  getVerificationBadgeText,
} from './stats';

describe('Badge Stats Calculator', () => {
  let mockDb: D1Database;

  beforeEach(() => {
    // Mock database
    mockDb = {
      prepare: vi.fn(() => ({
        bind: vi.fn(() => ({
          first: vi.fn(),
          all: vi.fn(),
        })),
      })),
    } as any;
  });

  describe('calculateSellerStats', () => {
    it('should calculate statistics for a seller with transactions', async () => {
      const mockSeller = {
        id: 'seller-123',
        name: 'Test Seller',
        kyc_tier: 'full',
        kyc_verified_at: '2026-01-01T00:00:00Z',
        created_at: '2025-01-01T00:00:00Z',
      };

      const mockTransactionStats = {
        total_transactions: 100,
        successful_transactions: 95,
        active_holds: 5,
        total_amount: 100000000,
      };

      vi.mocked(mockDb.prepare).mockReturnValue({
        bind: vi.fn().mockReturnValue({
          first: vi.fn()
            .mockResolvedValueOnce(mockSeller)
            .mockResolvedValueOnce(mockTransactionStats),
        }),
      } as any);

      const stats = await calculateSellerStats(mockDb, 'seller-123');

      expect(stats.sellerId).toBe('seller-123');
      expect(stats.sellerName).toBe('Test Seller');
      expect(stats.kycTier).toBe('full');
      expect(stats.kycVerified).toBe(true);
      expect(stats.totalTransactions).toBe(100);
      expect(stats.successfulTransactions).toBe(95);
      expect(stats.successRate).toBe(95);
      expect(stats.activeHolds).toBe(5);
      expect(stats.totalAmount).toBe(100000000);
    });

    it('should handle seller with no transactions', async () => {
      const mockSeller = {
        id: 'seller-456',
        name: 'New Seller',
        kyc_tier: 'none',
        kyc_verified_at: null,
        created_at: '2026-03-01T00:00:00Z',
      };

      const mockTransactionStats = {
        total_transactions: 0,
        successful_transactions: 0,
        active_holds: 0,
        total_amount: 0,
      };

      vi.mocked(mockDb.prepare).mockReturnValue({
        bind: vi.fn().mockReturnValue({
          first: vi.fn()
            .mockResolvedValueOnce(mockSeller)
            .mockResolvedValueOnce(mockTransactionStats),
        }),
      } as any);

      const stats = await calculateSellerStats(mockDb, 'seller-456');

      expect(stats.totalTransactions).toBe(0);
      expect(stats.successRate).toBe(100); // Default to 100% when no transactions
      expect(stats.kycVerified).toBe(false);
    });

    it('should throw error for non-existent seller', async () => {
      vi.mocked(mockDb.prepare).mockReturnValue({
        bind: vi.fn().mockReturnValue({
          first: vi.fn().mockResolvedValueOnce(null),
        }),
      } as any);

      await expect(calculateSellerStats(mockDb, 'invalid-id')).rejects.toThrow(
        'Seller not found'
      );
    });
  });

  describe('formatBadgeStats', () => {
    it('should format stats correctly', () => {
      const inputStats = {
        sellerId: 'seller-123',
        sellerName: 'Test Seller',
        kycTier: 'full' as const,
        kycVerified: true,
        totalTransactions: 100,
        successfulTransactions: 95,
        successRate: 95,
        totalAmount: 100000000,
        activeHolds: 5,
        memberSince: '2025-01-01T00:00:00Z',
      };

      const formatted = formatBadgeStats(inputStats);

      expect(formatted).toEqual({
        seller: {
          id: 'seller-123',
          name: 'Test Seller',
          kycTier: 'full',
          kycVerified: true,
        },
        stats: {
          totalTransactions: 100,
          successRate: 95,
          totalAmount: 100000000,
        },
        verification: {
          level: 'Verified',
          isVerified: true,
        },
      });
    });
  });

  describe('formatNumber', () => {
    it('should format numbers with Indonesian locale', () => {
      expect(formatNumber(1000)).toBe('1.000');
      expect(formatNumber(1000000)).toBe('1.000.000');
      expect(formatNumber(1500000)).toBe('1.500.000');
    });
  });

  describe('formatRupiah', () => {
    it('should format currency in Indonesian Rupiah', () => {
      const result = formatRupiah(1000000);
      expect(result).toContain('Rp');
      expect(result).toContain('1.000.000');

      expect(formatRupiah(1500000)).toContain('1.500.000');
      expect(formatRupiah(100000)).toContain('100.000');
    });
  });

  describe('formatDate', () => {
    it('should format date to Indonesian month and year', () => {
      const date = '2026-03-18T00:00:00Z';
      const formatted = formatDate(date);
      expect(formatted).toMatch(/2026/);
      expect(formatted).toMatch(/Maret/);
    });
  });

  describe('getSuccessRateColor', () => {
    it('should return correct color based on success rate', () => {
      expect(getSuccessRateColor(95)).toBe('green');
      expect(getSuccessRateColor(90)).toBe('blue');
      expect(getSuccessRateColor(75)).toBe('yellow');
      expect(getSuccessRateColor(60)).toBe('gray');
    });
  });

  describe('getVerificationBadgeText', () => {
    it('should return correct verification text', () => {
      expect(getVerificationBadgeText('full', true)).toBe('Verified Seller');
      expect(getVerificationBadgeText('basic', true)).toBe('Basic Verified');
      expect(getVerificationBadgeText('none', false)).toBe('Seller');
      expect(getVerificationBadgeText('full', false)).toBe('Seller');
    });
  });
});
