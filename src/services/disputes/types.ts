/**
 * Dispute status enum following the workflow
 */
export enum DisputeStatus {
  OPEN = 'open',
  SELLER_RESPONDING = 'seller_responding',
  UNDER_REVIEW = 'under_review',
  RESOLVED = 'resolved',
  CLOSED = 'closed',
}

/**
 * Reasons for raising a dispute
 * Extends the base DisputeReason from escrow types
 */
export enum DisputeReason {
  NOT_RECEIVED = 'not_received',
  NOT_AS_DESCRIBED = 'not_as_described',
  DAMAGED = 'damaged',
  WRONG_ITEM = 'wrong_item',
  OTHER = 'other',
}

/**
 * Dispute entity
 */
export interface Dispute {
  id: string;
  transaction_id: string;
  reason: DisputeReason;
  description?: string;
  status: DisputeStatus;
  buyer_email: string;
  seller_response?: string;
  seller_responded_at?: string;
  resolution?: string;
  resolved_for?: 'buyer' | 'seller';
  resolved_by?: string; // Admin ID
  admin_notes?: string;
  evidence_count?: number;
  created_at: string;
  updated_at: string;
  resolved_at?: string;
}

/**
 * DTO for creating a dispute
 */
export interface CreateDisputeDto {
  transaction_id: string;
  reason: DisputeReason;
  description?: string;
  buyer_email: string;
}

/**
 * DTO for seller response
 */
export interface SellerResponseDto {
  dispute_id: string;
  seller_id: string;
  response: string;
}

/**
 * DTO for dispute resolution
 */
export interface ResolveDisputeDto {
  dispute_id: string;
  resolution: string;
  outcome: 'buyer' | 'seller';
  admin_id: string;
  admin_notes?: string;
}

/**
 * Dispute list filters
 */
export interface DisputeListFilters {
  status?: DisputeStatus;
  seller_id?: string;
  transaction_id?: string;
  limit?: number;
  offset?: number;
}

/**
 * Dispute resolution result
 */
export interface DisputeResolutionResult {
  dispute: Dispute;
  transaction: any;
}
