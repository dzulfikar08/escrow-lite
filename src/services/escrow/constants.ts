/**
 * Escrow service configuration constants
 */

export const ESCROW_CONFIG = {
  /**
   * Fee rate applied to transactions (1%)
   */
  FEE_RATE: 0.01,

  /**
   * Minimum fee per transaction in Rp (Indonesian Rupiah)
   */
  MIN_FEE: 1000,

  /**
   * Default days after shipping before auto-release
   */
  AUTO_RELEASE_DAYS: 3,

  /**
   * Absolute timeout in days after transaction creation
   * Regardless of shipment status
   */
  ABSOLUTE_TIMEOUT_DAYS: 14,
} as const;

/**
 * Valid state transitions for the escrow state machine
 * Maps current status to array of allowed next statuses
 */
export const VALID_TRANSITIONS: Record<string, string[]> = {
  pending: ['funded'],
  funded: ['held'],
  held: ['released', 'disputed', 'expired'],
  disputed: ['resolved'],
  resolved: ['released', 'refunded'],
  released: ['paid_out'],
  refunded: [], // Terminal state
  expired: [], // Terminal state
  paid_out: [], // Terminal state
} as const;

/**
 * Release reasons for audit trail
 */
export const RELEASE_REASONS = {
  BUYER_CONFIRMED: 'buyer_confirmed',
  TIMEOUT: 'timeout',
  ADMIN_OVERRIDE: 'admin_override',
} as const;
