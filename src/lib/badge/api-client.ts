/**
 * Badge API Client
 *
 * Client-side API client for fetching badge statistics
 * Designed for cross-origin requests from any domain
 */

export interface BadgeWidgetConfig {
  sellerId: string;
  size: 'small' | 'medium' | 'large';
  theme: 'light' | 'dark';
  color: 'blue' | 'green' | 'neutral';
  showRating: boolean;
  showStats: boolean;
  position: 'auto' | 'left' | 'center' | 'right';
}

export interface BadgeStatsResponse {
  seller: {
    id: string;
    name: string;
    kycTier: 'none' | 'basic' | 'full';
    kycVerified: boolean;
  };
  stats: {
    totalTransactions: number;
    successRate: number;
    totalAmount: number;
  };
  verification: {
    level: string;
    isVerified: boolean;
  };
}

export interface BadgeApiError {
  error: string;
  code: string;
}

function isBadgeStatsResponse(data: unknown): data is BadgeStatsResponse {
  if (!data || typeof data !== 'object') {
    return false;
  }

  const candidate = data as Partial<BadgeStatsResponse>;

  return Boolean(
    candidate.seller &&
      candidate.stats &&
      candidate.verification &&
      typeof candidate.seller.id === 'string' &&
      typeof candidate.seller.name === 'string' &&
      typeof candidate.stats.totalTransactions === 'number' &&
      typeof candidate.stats.successRate === 'number' &&
      typeof candidate.stats.totalAmount === 'number'
  );
}

/**
 * Badge API Client class
 */
export class BadgeApiClient {
  private baseUrl: string;
  private sellerId: string;

  constructor(baseUrl: string, sellerId: string) {
    this.baseUrl = baseUrl.replace(/\/$/, ''); // Remove trailing slash
    this.sellerId = sellerId;
  }

  /**
   * Fetch seller statistics from the API
   */
  async fetchStats(): Promise<BadgeStatsResponse> {
    const url = `${this.baseUrl}/api/badge/${this.sellerId}/stats`;

    try {
      const response = await fetch(url, {
        method: 'GET',
        headers: {
          'Accept': 'application/json',
        },
        mode: 'cors', // Enable CORS for cross-origin requests
        cache: 'no-store', // Always fetch fresh data
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({
          error: 'Unknown error',
          code: 'UNKNOWN_ERROR',
        })) as BadgeApiError;
        throw new Error(errorData.error || `HTTP ${response.status}`);
      }

      const data = await response.json();
      if (!isBadgeStatsResponse(data)) {
        throw new Error('Invalid badge stats response');
      }
      return data;
    } catch (error) {
      if (error instanceof TypeError && error.message.includes('Failed to fetch')) {
        throw new Error('Network error - unable to reach Escrow Lite servers');
      }
      throw error;
    }
  }

  /**
   * Get verification URL for the seller
   */
  getVerificationUrl(): string {
    return `${this.baseUrl}/badge/${this.sellerId}/verify`;
  }

  /**
   * Check if the seller stats are valid
   */
  validateStats(data: BadgeStatsResponse): boolean {
    return !!(
      data?.seller?.id &&
      data?.stats &&
      typeof data.stats.totalTransactions === 'number' &&
      typeof data.stats.successRate === 'number'
    );
  }
}

/**
 * Create a badge API client instance
 */
export function createBadgeApiClient(
  baseUrl: string,
  sellerId: string
): BadgeApiClient {
  return new BadgeApiClient(baseUrl, sellerId);
}
