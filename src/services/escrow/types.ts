/**
 * Transaction lifecycle states
 */
export enum TransactionStatus {
  PENDING = 'pending', // Initial state, awaiting buyer payment
  HELD = 'held', // Payment received, funds held in escrow
  RELEASED = 'released', // Funds released to seller
  REFUNDED = 'refunded', // Funds refunded to buyer
}

/**
 * KYC verification tiers with different transaction limits
 */
export enum KycTier {
  TIER_1 = 'tier_1', // Basic verification (₦100,000 limit)
  TIER_2 = 'tier_2', // Intermediate verification (₦500,000 limit)
  TIER_3 = 'tier_3', // Full verification (₦2,000,000 limit)
}

/**
 * Reasons for releasing funds from escrow
 */
export enum ReleaseReason {
  DELIVERY_CONFIRMED = 'delivery_confirmed', // Buyer confirmed delivery
  AUTO_RELEASE = 'auto_release', // Auto-release after 7 days
  DISPUTE_RESOLVED = 'dispute_resolved', // Dispute resolved in seller's favor
}

/**
 * Reasons for raising a dispute
 */
export enum DisputeReason {
  GOODS_NOT_RECEIVED = 'goods_not_received', // Buyer didn't receive goods
  GOODS_DAMAGED = 'goods_damaged', // Goods received were damaged
  NOT_AS_DESCRIBED = 'not_as_described', // Goods don't match description
  OTHER = 'other', // Other reasons (requires description)
}

/**
 * Payment gateway options
 */
export enum Gateway {
  PAYSTACK = 'paystack',
  FLUTTERWAVE = 'flutterwave',
}

/**
 * Seller entity with KYC verification and balances
 */
export interface Seller {
  id: string;
  auth_id: string; // Reference to auth.users.id
  business_name: string;
  email: string;
  phone: string;
  kyc_tier: KycTier;
  kyc_verified_at?: Date;
  balance_available: number; // Available for withdrawal
  balance_pending: number; // Held in active transactions
  bank_account: {
    bank_name: string;
    account_number: string;
    account_name: string;
  };
  created_at: Date;
  updated_at: Date;
}

/**
 * Transaction entity - core escrow transaction
 */
export interface Transaction {
  id: string;
  seller_id: string; // Foreign key to sellers.id
  buyer_email: string;
  buyer_phone: string;
  amount: number;
  fee_amount: number;
  gateway: Gateway;
  gateway_transaction_id?: string; // External payment reference
  status: TransactionStatus;
  release_reason?: ReleaseReason;
  metadata?: Record<string, unknown>;
  created_at: Date;
  updated_at: Date;
  released_at?: Date;
  refunded_at?: Date;
}

/**
 * Ledger entry for tracking all balance changes
 */
export interface LedgerEntry {
  id: string;
  seller_id: string;
  transaction_id: string;
  type: 'credit' | 'debit';
  amount: number;
  description: string;
  balance_before: number;
  balance_after: number;
  created_at: Date;
}

/**
 * Payout request for seller withdrawals
 */
export interface Payout {
  id: string;
  seller_id: string;
  amount: number;
  status: 'pending' | 'processing' | 'completed' | 'failed';
  bank_account: {
    bank_name: string;
    account_number: string;
    account_name: string;
  };
  gateway_reference?: string;
  failure_reason?: string;
  created_at: Date;
  updated_at: Date;
  completed_at?: Date;
}

/**
 * Dispute raised by buyer
 */
export interface Dispute {
  id: string;
  transaction_id: string;
  reason: DisputeReason;
  description?: string;
  status: 'open' | 'investigating' | 'resolved' | 'closed';
  resolution?: string;
  admin_notes?: string;
  created_at: Date;
  updated_at: Date;
  resolved_at?: Date;
}

/**
 * DTO for creating a new transaction
 */
export interface CreateTransactionDto {
  seller_id: string;
  buyer_email: string;
  buyer_phone: string;
  amount: number;
  gateway: Gateway;
  metadata?: Record<string, unknown>;
}

/**
 * Seller balance summary
 */
export interface SellerBalances {
  available: number; // Available for withdrawal
  pending: number; // Held in active transactions
  total_earned: number; // Lifetime earnings
}
