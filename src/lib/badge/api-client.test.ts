/**
 * Badge API Client Tests
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { BadgeApiClient, createBadgeApiClient } from './api-client';

describe('BadgeApiClient', () => {
  let client: BadgeApiClient;
  let mockFetch: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    // Mock fetch globally
    mockFetch = vi.fn();
    global.fetch = mockFetch;

    client = new BadgeApiClient('https://escrow-lite.id', 'test-seller-id');
  });

  describe('constructor', () => {
    it('should create instance with baseUrl and sellerId', () => {
      expect(client).toBeInstanceOf(BadgeApiClient);
    });

    it('should remove trailing slash from baseUrl', () => {
      const clientWithSlash = new BadgeApiClient('https://escrow-lite.id/', 'test-id');
      expect(clientWithSlash).toBeInstanceOf(BadgeApiClient);
    });
  });

  describe('fetchStats', () => {
    it('should fetch stats successfully', async () => {
      const mockStats = {
        seller: {
          id: 'test-seller-id',
          name: 'Test Seller',
          kycTier: 'full',
          kycVerified: true,
        },
        stats: {
          totalTransactions: 100,
          successRate: 95,
          totalAmount: 50000000,
        },
        verification: {
          level: 'Verified',
          isVerified: true,
        },
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => mockStats,
      });

      const result = await client.fetchStats();

      expect(result).toEqual(mockStats);
      expect(mockFetch).toHaveBeenCalledWith(
        'https://escrow-lite.id/api/badge/test-seller-id/stats',
        expect.objectContaining({
          method: 'GET',
          mode: 'cors',
          cache: 'no-store',
        })
      );
    });

    it('should handle HTTP errors', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 404,
        json: async () => ({ error: 'Seller not found', code: 'NOT_FOUND' }),
      });

      await expect(client.fetchStats()).rejects.toThrow('Seller not found');
    });

    it('should handle network errors', async () => {
      mockFetch.mockRejectedValueOnce(
        new TypeError('Failed to fetch')
      );

      await expect(client.fetchStats()).rejects.toThrow(
        'Network error - unable to reach Escrow Lite servers'
      );
    });

    it('should handle malformed JSON', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => {
          throw new Error('Invalid JSON');
        },
      });

      await expect(client.fetchStats()).rejects.toThrow();
    });
  });

  describe('getVerificationUrl', () => {
    it('should return correct verification URL', () => {
      const url = client.getVerificationUrl();
      expect(url).toBe('https://escrow-lite.id/badge/test-seller-id/verify');
    });
  });

  describe('validateStats', () => {
    it('should validate correct stats', () => {
      const validStats = {
        seller: {
          id: 'test-id',
          name: 'Test',
          kycTier: 'full',
          kycVerified: true,
        },
        stats: {
          totalTransactions: 100,
          successRate: 95,
          totalAmount: 50000,
        },
        verification: {
          level: 'Verified',
          isVerified: true,
        },
      };

      expect(client.validateStats(validStats)).toBe(true);
    });

    it('should reject invalid stats - missing seller', () => {
      const invalidStats = {
        stats: {
          totalTransactions: 100,
          successRate: 95,
          totalAmount: 50000,
        },
        verification: {
          level: 'Verified',
          isVerified: true,
        },
      };

      expect(client.validateStats(invalidStats as any)).toBe(false);
    });

    it('should reject invalid stats - missing stats', () => {
      const invalidStats = {
        seller: {
          id: 'test-id',
          name: 'Test',
          kycTier: 'full',
          kycVerified: true,
        },
        verification: {
          level: 'Verified',
          isVerified: true,
        },
      };

      expect(client.validateStats(invalidStats as any)).toBe(false);
    });

    it('should reject invalid stats - invalid transaction count', () => {
      const invalidStats = {
        seller: {
          id: 'test-id',
          name: 'Test',
          kycTier: 'full',
          kycVerified: true,
        },
        stats: {
          totalTransactions: 'invalid' as any,
          successRate: 95,
          totalAmount: 50000,
        },
        verification: {
          level: 'Verified',
          isVerified: true,
        },
      };

      expect(client.validateStats(invalidStats)).toBe(false);
    });

    it('should reject invalid stats - invalid success rate', () => {
      const invalidStats = {
        seller: {
          id: 'test-id',
          name: 'Test',
          kycTier: 'full',
          kycVerified: true,
        },
        stats: {
          totalTransactions: 100,
          successRate: 'invalid' as any,
          totalAmount: 50000,
        },
        verification: {
          level: 'Verified',
          isVerified: true,
        },
      };

      expect(client.validateStats(invalidStats)).toBe(false);
    });
  });
});

describe('createBadgeApiClient', () => {
  it('should create BadgeApiClient instance', () => {
    const client = createBadgeApiClient('https://escrow-lite.id', 'test-id');
    expect(client).toBeInstanceOf(BadgeApiClient);
  });
});
