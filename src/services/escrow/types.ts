/**
 * Transaction lifecycle states
 */
export enum TransactionStatus {
  PENDING = 'pending', // Initial state, awaiting buyer payment
  FUNDED = 'funded', // Payment received from gateway
  HELD = 'held', // Funds held in escrow
  RELEASED = 'released', // Funds released to seller
  DISPUTED = 'disputed', // Dispute opened
  REFUNDED = 'refunded', // Funds refunded to buyer
  EXPIRED = 'expired', // Auto-released after timeout
}

/**
 * KYC verification tiers with different transaction limits
 */
export enum KycTier {
  NONE = 'none', // No verification (Rp 1M max transaction, Rp 5M held)
  BASIC = 'basic', // Basic verification (Rp 10M max transaction, Rp 50M held)
  FULL = 'full', // Full verification (unlimited)
}

/**
 * Reasons for releasing funds from escrow
 */
export enum ReleaseReason {
  BUYER_CONFIRMED = 'buyer_confirmed', // Buyer confirmed receipt
  TIMEOUT = 'timeout', // Auto-release after timeout period
  ADMIN_OVERRIDE = 'admin_override', // Admin manually released
}

/**
 * Reasons for raising a dispute
 */
export enum DisputeReason {
  NOT_RECEIVED = 'not_received', // Buyer didn't receive goods
  NOT_AS_DESCRIBED = 'not_as_described', // Goods don't match description
  DAMAGED = 'damaged', // Goods received were damaged
  WRONG_ITEM = 'wrong_item', // Wrong item sent
  OTHER = 'other', // Other reasons (requires description)
}

/**
 * Payment gateway options
 */
export enum Gateway {
  MIDTRANS = 'midtrans',
  XENDIT = 'xendit',
  DOKU = 'doku',
}

/**
 * Seller entity with KYC verification and balances
 */
export interface Seller {
  id: string;
  auth_id: string; // Reference to auth.users.id
  name: string;
  email: string;
  phone: string;
  kyc_tier: KycTier;
  kyc_verified_at?: Date;
  webhook_url?: string;
  max_transaction_amount?: number;
  max_held_balance?: number;
  metadata?: Record<string, unknown>;
  version: number; // For optimistic locking
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
  fee_rate: number; // Fee rate applied (e.g., 0.01 for 1%)
  fee_amount: number; // Calculated fee
  net_amount: number; // amount - fee_amount
  gateway: Gateway;
  gateway_transaction_id?: string; // External payment reference
  status: TransactionStatus;
  auto_release_days?: number; // Days before auto-release
  auto_release_at?: Date; // Calculated auto-release timestamp
  absolute_expire_at?: Date; // Absolute timeout (14 days)
  shipped_at?: Date; // When seller marked as shipped
  release_reason?: ReleaseReason;
  refunded_at?: Date;
  refund_reason?: string;
  metadata?: Record<string, unknown>;
  last_checked_at?: Date; // For timeout idempotency
  created_at: Date;
  updated_at: Date;
  released_at?: Date;
}

/**
 * Ledger entry for tracking all balance changes
 */
export interface LedgerEntry {
  id: string;
  seller_id: string;
  transaction_id?: string; // Optional for adjustments
  type: 'hold' | 'release' | 'fee' | 'payout' | 'refund' | 'adjustment';
  direction: 'in' | 'out'; // Money in or out
  amount: number;
  description: string;
  balance_before: number;
  balance_after: number;
  metadata?: Record<string, unknown>;
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
  bank_code: string; // Bank code (e.g., "BCA")
  account_number: string; // Bank account number
  account_name: string; // Account holder name
  disbursement_ref?: string; // External disbursement reference
  failed_reason?: string;
  requested_at: Date;
  completed_at?: Date;
  created_at: Date;
  updated_at: Date;
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
  resolved_for?: 'buyer' | 'seller'; // Who won the dispute
  admin_notes?: string;
  evidence_count?: number; // Number of evidence files
  created_at: Date;
  updated_at: Date;
  resolved_at?: Date;
}

/**
 * DTO for creating a new transaction
 */
export interface CreateTransactionDto {
  buyer_email: string;
  buyer_phone: string;
  amount: number;
  auto_release_days?: number;
  metadata?: Record<string, unknown>;
}

/**
 * Seller balance summary
 */
export interface SellerBalances {
  held_balance: number; // Held in active transactions
  available_balance: number; // Available for withdrawal
  pending_payouts: number; // Payouts in progress
  total_paid_out: number; // Total amount paid out
}
