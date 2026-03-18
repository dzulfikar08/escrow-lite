import { z } from 'zod';

/**
 * Seller registration schema
 */
export const sellerRegistrationSchema = z.object({
  business_name: z
    .string()
    .min(3, 'Business name must be at least 3 characters')
    .max(100, 'Business name must not exceed 100 characters'),
  email: z.string().email('Invalid email address'),
  phone: z
    .string()
    .regex(/^234[789]\d{9}$/, 'Phone must be in format 234XXXXXXXXX'),
  password: z
    .string()
    .min(8, 'Password must be at least 8 characters')
    .regex(/[A-Z]/, 'Password must contain at least one uppercase letter')
    .regex(/[a-z]/, 'Password must contain at least one lowercase letter')
    .regex(/[0-9]/, 'Password must contain at least one number'),
  bank_account: z.object({
    bank_name: z.string().min(1, 'Bank name is required'),
    account_number: z.string().regex(/^\d{10}$/, 'Account number must be 10 digits'),
    account_name: z.string().min(1, 'Account name is required'),
  }),
});

export type SellerRegistrationInput = z.infer<typeof sellerRegistrationSchema>;

/**
 * Login schema
 */
export const loginSchema = z.object({
  email: z.string().email('Invalid email address'),
  password: z.string().min(1, 'Password is required'),
});

export type LoginInput = z.infer<typeof loginSchema>;

/**
 * Create transaction schema
 */
export const createTransactionSchema = z.object({
  seller_id: z.string().uuid('Invalid seller ID'),
  buyer_email: z.string().email('Invalid buyer email'),
  buyer_phone: z
    .string()
    .regex(/^234[789]\d{9}$/, 'Phone must be in format 234XXXXXXXXX'),
  amount: z.number().positive('Amount must be positive').min(100, 'Minimum amount is ₦100'),
  gateway: z.enum(['paystack', 'flutterwave'], {
    errorMap: () => ({ message: 'Gateway must be paystack or flutterwave' }),
  }),
  metadata: z.record(z.unknown()).optional(),
});

export type CreateTransactionInput = z.infer<typeof createTransactionSchema>;

/**
 * Request payout schema
 */
export const requestPayoutSchema = z.object({
  amount: z.number().positive('Amount must be positive').min(100, 'Minimum payout is ₦100'),
  bank_account: z
    .object({
      bank_name: z.string().min(1, 'Bank name is required'),
      account_number: z.string().regex(/^\d{10}$/, 'Account number must be 10 digits'),
      account_name: z.string().min(1, 'Account name is required'),
    })
    .optional(),
});

export type RequestPayoutInput = z.infer<typeof requestPayoutSchema>;

/**
 * Create dispute schema
 */
export const createDisputeSchema = z.object({
  transaction_id: z.string().uuid('Invalid transaction ID'),
  reason: z.enum(
    ['goods_not_received', 'goods_damaged', 'not_as_described', 'other'],
    {
      errorMap: () => ({ message: 'Invalid dispute reason' }),
    }
  ),
  description: z
    .string()
    .max(1000, 'Description must not exceed 1000 characters')
    .optional(),
});

export type CreateDisputeInput = z.infer<typeof createDisputeSchema>;

/**
 * KYC verification schema (Tier 2)
 */
export const kycVerificationSchema = z.object({
  tier: z.enum(['tier_2', 'tier_3'], {
    errorMap: () => ({ message: 'Invalid KYC tier' }),
  }),
  identity_document: z.object({
    type: z.enum(['nid', 'passport', 'drivers_license'], {
      errorMap: () => ({ message: 'Invalid document type' }),
    }),
    number: z.string().min(1, 'Document number is required'),
    image_url: z.string().url('Invalid image URL'),
  }),
  address_verification: z
    .object({
      street: z.string().min(1, 'Street address is required'),
      city: z.string().min(1, 'City is required'),
      state: z.string().min(1, 'State is required'),
      postal_code: z.string().min(1, 'Postal code is required'),
      document_url: z.string().url('Invalid document URL'),
    })
    .optional(),
});

export type KycVerificationInput = z.infer<typeof kycVerificationSchema>;

/**
 * Pagination query schema
 */
export const paginationQuerySchema = z.object({
  page: z.coerce.number().int().positive().optional().default(1),
  limit: z.coerce.number().int().positive().max(100).optional().default(20),
  sort_by: z.string().optional(),
  sort_order: z.enum(['asc', 'desc']).optional().default('desc'),
});

export type PaginationQuery = z.infer<typeof paginationQuerySchema>;

/**
 * Pagination response schema
 */
export const paginationResponseSchema = z.object({
  data: z.array(z.unknown()),
  meta: z.object({
    total: z.number(),
    page: z.number(),
    limit: z.number(),
    pages: z.number(),
  }),
});

export type PaginationResponse<T> = {
  data: T[];
  meta: {
    total: number;
    page: number;
    limit: number;
    pages: number;
  };
};

/**
 * API success response schema
 */
export const apiResponseSchema = <T extends z.ZodTypeAny>(dataSchema: T) =>
  z.object({
    success: z.literal(true),
    data: dataSchema,
    message: z.string().optional(),
  });

export type ApiResponse<T> = {
  success: true;
  data: T;
  message?: string;
};

/**
 * API error response schema
 */
export const apiErrorSchema = z.object({
  success: z.literal(false),
  error: z.object({
    message: z.string(),
    code: z.string(),
    statusCode: z.number(),
    fields: z.record(z.string()).optional(),
    retryAfter: z.number().optional(),
    gatewayCode: z.string().optional(),
  }),
});

export type ApiErrorResponse = {
  success: false;
  error: {
    message: string;
    code: string;
    statusCode: number;
    fields?: Record<string, string>;
    retryAfter?: number;
    gatewayCode?: string;
  };
};

/**
 * Transaction query filters
 */
export const transactionQuerySchema = paginationQuerySchema.extend({
  status: z
    .enum(['pending', 'held', 'released', 'refunded'])
    .optional(),
  gateway: z.enum(['paystack', 'flutterwave']).optional(),
  seller_id: z.string().uuid().optional(),
  start_date: z.coerce.date().optional(),
  end_date: z.coerce.date().optional(),
});

export type TransactionQuery = z.infer<typeof transactionQuerySchema>;

/**
 * Payout query filters
 */
export const payoutQuerySchema = paginationQuerySchema.extend({
  status: z.enum(['pending', 'processing', 'completed', 'failed']).optional(),
  seller_id: z.string().uuid().optional(),
});

export type PayoutQuery = z.infer<typeof payoutQuerySchema>;

/**
 * Dispute query filters
 */
export const disputeQuerySchema = paginationQuerySchema.extend({
  status: z.enum(['open', 'investigating', 'resolved', 'closed']).optional(),
  transaction_id: z.string().uuid().optional(),
});

export type DisputeQuery = z.infer<typeof disputeQuerySchema>;
