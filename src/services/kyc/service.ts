import type { D1Database } from '@cloudflare/workers-types';
import { NotFoundError, ValidationError } from '@/lib/errors';
import { GET_SELLER_BY_ID, GET_SELLER_KYC_LIMITS } from '@/db/queries/sellers';

export type KycTier = 'none' | 'basic' | 'full';

export interface KycLimits {
  max_transaction_amount: number | null;
  max_held_balance: number | null;
}

export const KYC_TIER_LIMITS: Record<KycTier, KycLimits> = {
  none: {
    max_transaction_amount: 1_000_000,
    max_held_balance: 5_000_000,
  },
  basic: {
    max_transaction_amount: 10_000_000,
    max_held_balance: 50_000_000,
  },
  full: {
    max_transaction_amount: null,
    max_held_balance: null,
  },
} as const;

export const VALID_KYC_TIERS: KycTier[] = ['none', 'basic', 'full'];

export class KycService {
  constructor(private db: D1Database) {}

  async getKycTier(sellerId: string): Promise<KycTier> {
    const seller = await this.db
      .prepare(GET_SELLER_BY_ID)
      .bind(sellerId)
      .first<{ kyc_tier: string }>();

    if (!seller) {
      throw new NotFoundError(`Seller ${sellerId} not found`);
    }

    return seller.kyc_tier as KycTier;
  }

  async updateKycTier(
    sellerId: string,
    tier: KycTier,
    adminId: string,
    reason: string
  ): Promise<KycTier> {
    if (!VALID_KYC_TIERS.includes(tier)) {
      throw new ValidationError(
        `Invalid KYC tier: ${tier}. Must be one of: ${VALID_KYC_TIERS.join(', ')}`
      );
    }

    if (!reason || reason.trim().length === 0) {
      throw new ValidationError('Reason is required when updating KYC tier');
    }

    const seller = await this.db
      .prepare(GET_SELLER_BY_ID)
      .bind(sellerId)
      .first<{ kyc_tier: string }>();

    if (!seller) {
      throw new NotFoundError(`Seller ${sellerId} not found`);
    }

    const limits = KYC_TIER_LIMITS[tier];
    const now = new Date().toISOString();

    await this.db
      .prepare(
        `UPDATE sellers
         SET kyc_tier = ?, kyc_verified_at = ?, max_transaction_amount = ?, max_held_balance = ?, updated_at = ?
         WHERE id = ?`
      )
      .bind(
        tier,
        tier === 'none' ? null : now,
        limits.max_transaction_amount,
        limits.max_held_balance,
        now,
        sellerId
      )
      .run();

    await this.db
      .prepare(
        `INSERT INTO audit_log (id, actor_type, actor_id, action, target_type, target_id, old_values, new_values, reason, created_at)
         VALUES (?, 'admin', ?, 'seller.update_kyc', 'seller', ?, ?, ?, ?, datetime('now'))`
      )
      .bind(
        `aud_${crypto.randomUUID()}`,
        adminId,
        sellerId,
        JSON.stringify({ kyc_tier: seller.kyc_tier }),
        JSON.stringify({ kyc_tier: tier }),
        reason
      )
      .run();

    return tier;
  }

  getKycLimits(tier: KycTier): KycLimits {
    const limits = KYC_TIER_LIMITS[tier];
    if (!limits) {
      throw new ValidationError(
        `Invalid KYC tier: ${tier}. Must be one of: ${VALID_KYC_TIERS.join(', ')}`
      );
    }
    return limits;
  }

  async validateTransactionAgainstKyc(
    sellerId: string,
    amount: number
  ): Promise<{ allowed: boolean; reason?: string }> {
    const limits = await this.db
      .prepare(GET_SELLER_KYC_LIMITS)
      .bind(sellerId)
      .first<{
        kyc_tier: string;
        max_transaction_amount: number | null;
        max_held_balance: number | null;
      }>();

    if (!limits) {
      throw new NotFoundError(`Seller ${sellerId} not found`);
    }

    if (limits.max_transaction_amount !== null && amount > limits.max_transaction_amount) {
      return {
        allowed: false,
        reason: `Transaction amount Rp ${amount.toLocaleString('id-ID')} exceeds KYC tier ${limits.kyc_tier} limit of Rp ${limits.max_transaction_amount.toLocaleString('id-ID')}`,
      };
    }

    if (limits.max_held_balance !== null) {
      const balanceResult = await this.db
        .prepare(
          `SELECT COALESCE(SUM(amount), 0) as total_held
           FROM transactions
           WHERE seller_id = ? AND status IN ('held', 'disputed')`
        )
        .bind(sellerId)
        .first<{ total_held: number }>();

      const currentHeld = balanceResult?.total_held || 0;

      if (currentHeld + amount > limits.max_held_balance) {
        return {
          allowed: false,
          reason: `Transaction would exceed KYC tier ${limits.kyc_tier} held balance limit of Rp ${limits.max_held_balance.toLocaleString('id-ID')}. Current held: Rp ${currentHeld.toLocaleString('id-ID')}`,
        };
      }
    }

    return { allowed: true };
  }
}
