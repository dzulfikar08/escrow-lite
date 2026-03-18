import { z } from 'zod';

// Validation constants
export const MIN_NAME_LENGTH = 3;
export const MAX_NAME_LENGTH = 100;
export const MIN_PASSWORD_LENGTH = 8;

/**
 * Seller registration schema
 */
export const registerSellerSchema = z.object({
  name: z
    .string()
    .min(MIN_NAME_LENGTH, `Name must be at least ${MIN_NAME_LENGTH} characters`)
    .max(MAX_NAME_LENGTH, `Name must not exceed ${MAX_NAME_LENGTH} characters`),
  email: z.string().email('Invalid email address'),
  password: z
    .string()
    .min(MIN_PASSWORD_LENGTH, `Password must be at least ${MIN_PASSWORD_LENGTH} characters`)
    .regex(/[A-Z]/, 'Password must contain at least one uppercase letter')
    .regex(/[a-z]/, 'Password must contain at least one lowercase letter')
    .regex(/[0-9]/, 'Password must contain at least one number'),
});

export type RegisterSellerInput = z.infer<typeof registerSellerSchema>;

/**
 * Login schema
 */
export const loginSellerSchema = z.object({
  email: z.string().email('Invalid email address'),
  password: z.string().min(1, 'Password is required'),
});

export type LoginSellerInput = z.infer<typeof loginSellerSchema>;

/**
 * Create transaction schema
 */
export const createTransactionSchema = z.object({
  buyer_email: z.string().email('Invalid buyer email'),
  buyer_phone: z
    .string()
    .regex(/^\+62\d{8,12}$/, 'Phone number must be in Indonesian format (+62 followed by 8-12 digits)'),
  amount: z.number().positive('Amount must be positive'),
  auto_release_days: z.number().int().positive().optional(),
  metadata: z.record(z.unknown()).optional(),
});

export type CreateTransactionInput = z.infer<typeof createTransactionSchema>;

/**
 * Mark as shipped schema
 */
export const markAsShippedSchema = z.object({
  transaction_id: z.string().uuid('Invalid transaction ID'),
});

export type MarkAsShippedInput = z.infer<typeof markAsShippedSchema>;

/**
 * Create bank account schema
 */
export const createBankAccountSchema = z.object({
  bank_code: z.string().min(1, 'Bank code is required'),
  account_number: z.string().min(1, 'Account number is required'),
  account_name: z.string().min(1, 'Account name is required'),
});

export type CreateBankAccountInput = z.infer<typeof createBankAccountSchema>;

/**
 * Add dispute evidence schema
 */
export const addDisputeEvidenceSchema = z.object({
  dispute_id: z.string().uuid('Invalid dispute ID'),
  file_url: z.string().url('Invalid file URL'),
  description: z.string().optional(),
});

export type AddDisputeEvidenceInput = z.infer<typeof addDisputeEvidenceSchema>;

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
    details: z.record(z.unknown()).optional(),
  }),
  meta: z.object({
    request_id: z.string(),
    timestamp: z.string(),
  }),
});

export type ApiErrorResponse = {
  success: false;
  error: {
    message: string;
    code: string;
    details?: Record<string, unknown>;
  };
  meta: {
    request_id: string;
    timestamp: string;
  };
};
