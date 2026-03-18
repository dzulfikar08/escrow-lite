/**
 * Badge Statistics Calculator
 *
 * Calculates seller statistics for the trust badge widget
 */

export interface SellerStats {
  sellerId: string;
  sellerName: string;
  kycTier: 'none' | 'basic' | 'full';
  kycVerified: boolean;
  totalTransactions: number;
  successfulTransactions: number;
  successRate: number;
  totalAmount: number;
  activeHolds: number;
  memberSince: string;
}

export interface BadgeStats {
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

/**
 * Calculate seller statistics for badge display
 */
export async function calculateSellerStats(
  db: D1Database,
  sellerId: string
): Promise<SellerStats> {
  // Get seller information
  const sellerResult = await db
    .prepare(
      `SELECT id, name, kyc_tier, kyc_verified_at, created_at
       FROM sellers
       WHERE id = ?`
    )
    .bind(sellerId)
    .first();

  if (!sellerResult) {
    throw new Error('Seller not found');
  }

  // Get transaction statistics
  const transactionStats = await db
    .prepare(
      `SELECT
        COUNT(*) as total_transactions,
        SUM(CASE WHEN status IN ('released', 'paid_out') THEN 1 ELSE 0 END) as successful_transactions,
        SUM(CASE WHEN status IN ('held', 'disputed') THEN 1 ELSE 0 END) as active_holds,
        SUM(amount) as total_amount
       FROM transactions
       WHERE seller_id = ?`
    )
    .bind(sellerId)
    .first();

  const totalTransactions = transactionStats?.total_transactions || 0;
  const successfulTransactions = transactionStats?.successful_transactions || 0;
  const activeHolds = transactionStats?.active_holds || 0;
  const totalAmount = transactionStats?.total_amount || 0;

  // Calculate success rate
  const successRate =
    totalTransactions > 0
      ? Math.round((successfulTransactions / totalTransactions) * 100)
      : 100;

  return {
    sellerId: sellerResult.id as string,
    sellerName: sellerResult.name as string,
    kycTier: sellerResult.kyc_tier as 'none' | 'basic' | 'full',
    kycVerified: sellerResult.kyc_verified_at !== null,
    totalTransactions,
    successfulTransactions,
    successRate,
    totalAmount,
    activeHolds,
    memberSince: sellerResult.created_at as string,
  };
}

/**
 * Format stats for badge widget response
 */
export function formatBadgeStats(stats: SellerStats): BadgeStats {
  return {
    seller: {
      id: stats.sellerId,
      name: stats.sellerName,
      kycTier: stats.kycTier,
      kycVerified: stats.kycVerified,
    },
    stats: {
      totalTransactions: stats.totalTransactions,
      successRate: stats.successRate,
      totalAmount: stats.totalAmount,
    },
    verification: {
      level: getKycLevelLabel(stats.kycTier),
      isVerified: stats.kycVerified,
    },
  };
}

/**
 * Get human-readable KYC level label
 */
function getKycLevelLabel(tier: string): string {
  const labels = {
    none: 'Unverified',
    basic: 'Basic',
    full: 'Verified',
  };
  return labels[tier as keyof typeof labels] || 'Unknown';
}

/**
 * Format number with Indonesian locale
 */
export function formatNumber(num: number): string {
  return new Intl.NumberFormat('id-ID').format(num);
}

/**
 * Format currency in Indonesian Rupiah
 */
export function formatRupiah(amount: number): string {
  return new Intl.NumberFormat('id-ID', {
    style: 'currency',
    currency: 'IDR',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount);
}

/**
 * Format date for display
 */
export function formatDate(dateString: string): string {
  const date = new Date(dateString);
  return new Intl.DateTimeFormat('id-ID', {
    year: 'numeric',
    month: 'long',
  }).format(date);
}

/**
 * Get badge color based on success rate
 */
export function getSuccessRateColor(successRate: number): string {
  if (successRate >= 95) return 'green';
  if (successRate >= 85) return 'blue';
  if (successRate >= 70) return 'yellow';
  return 'gray';
}

/**
 * Get verification badge text
 */
export function getVerificationBadgeText(
  kycTier: string,
  kycVerified: boolean
): string {
  if (kycVerified && kycTier === 'full') {
    return 'Verified Seller';
  }
  if (kycVerified && kycTier === 'basic') {
    return 'Basic Verified';
  }
  return 'Seller';
}
