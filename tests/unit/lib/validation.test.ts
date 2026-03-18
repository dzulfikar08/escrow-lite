import { describe, it, expect } from 'vitest';
import {
  sellerRegistrationSchema,
  loginSchema,
  createTransactionSchema,
  requestPayoutSchema,
  createDisputeSchema,
  kycVerificationSchema,
  paginationQuerySchema,
  transactionQuerySchema,
  payoutQuerySchema,
  disputeQuerySchema,
  type SellerRegistrationInput,
  type LoginInput,
  type CreateTransactionInput,
} from '../../../src/lib/validation';

describe('Validation Schemas', () => {
  describe('sellerRegistrationSchema', () => {
    const validData = {
      business_name: 'Test Business',
      email: 'test@example.com',
      phone: '2348012345678',
      password: 'Password123',
      bank_account: {
        bank_name: 'GTBank',
        account_number: '0123456789',
        account_name: 'John Doe',
      },
    };

    it('should validate valid seller registration', () => {
      const result = sellerRegistrationSchema.safeParse(validData);
      expect(result.success).toBe(true);
    });

    it('should reject invalid email', () => {
      const result = sellerRegistrationSchema.safeParse({
        ...validData,
        email: 'invalid-email',
      });
      expect(result.success).toBe(false);
    });

    it('should reject invalid phone format', () => {
      const result = sellerRegistrationSchema.safeParse({
        ...validData,
        phone: '08012345678',
      });
      expect(result.success).toBe(false);
    });

    it('should reject weak password', () => {
      const result = sellerRegistrationSchema.safeParse({
        ...validData,
        password: 'weak',
      });
      expect(result.success).toBe(false);
    });

    it('should reject invalid account number', () => {
      const result = sellerRegistrationSchema.safeParse({
        ...validData,
        bank_account: {
          ...validData.bank_account,
          account_number: '123',
        },
      });
      expect(result.success).toBe(false);
    });

    it('should reject business name less than 3 characters', () => {
      const result = sellerRegistrationSchema.safeParse({
        ...validData,
        business_name: 'AB',
      });
      expect(result.success).toBe(false);
    });
  });

  describe('loginSchema', () => {
    it('should validate valid login', () => {
      const result = loginSchema.safeParse({
        email: 'test@example.com',
        password: 'password123',
      });
      expect(result.success).toBe(true);
    });

    it('should reject invalid email', () => {
      const result = loginSchema.safeParse({
        email: 'invalid',
        password: 'password123',
      });
      expect(result.success).toBe(false);
    });

    it('should reject empty password', () => {
      const result = loginSchema.safeParse({
        email: 'test@example.com',
        password: '',
      });
      expect(result.success).toBe(false);
    });
  });

  describe('createTransactionSchema', () => {
    const validData = {
      seller_id: '550e8400-e29b-41d4-a716-446655440000',
      buyer_email: 'buyer@example.com',
      buyer_phone: '2348012345678',
      amount: 5000,
      gateway: 'paystack' as const,
    };

    it('should validate valid transaction', () => {
      const result = createTransactionSchema.safeParse(validData);
      expect(result.success).toBe(true);
    });

    it('should reject invalid seller ID', () => {
      const result = createTransactionSchema.safeParse({
        ...validData,
        seller_id: 'invalid-uuid',
      });
      expect(result.success).toBe(false);
    });

    it('should reject amount less than 100', () => {
      const result = createTransactionSchema.safeParse({
        ...validData,
        amount: 50,
      });
      expect(result.success).toBe(false);
    });

    it('should reject invalid gateway', () => {
      const result = createTransactionSchema.safeParse({
        ...validData,
        gateway: 'paypal',
      });
      expect(result.success).toBe(false);
    });

    it('should accept optional metadata', () => {
      const result = createTransactionSchema.safeParse({
        ...validData,
        metadata: { order_id: '12345' },
      });
      expect(result.success).toBe(true);
    });
  });

  describe('requestPayoutSchema', () => {
    const validData = {
      amount: 5000,
    };

    it('should validate valid payout request', () => {
      const result = requestPayoutSchema.safeParse(validData);
      expect(result.success).toBe(true);
    });

    it('should accept payout with bank account', () => {
      const result = requestPayoutSchema.safeParse({
        ...validData,
        bank_account: {
          bank_name: 'GTBank',
          account_number: '0123456789',
          account_name: 'John Doe',
        },
      });
      expect(result.success).toBe(true);
    });

    it('should reject amount less than 100', () => {
      const result = requestPayoutSchema.safeParse({
        amount: 50,
      });
      expect(result.success).toBe(false);
    });
  });

  describe('createDisputeSchema', () => {
    const validData = {
      transaction_id: '550e8400-e29b-41d4-a716-446655440000',
      reason: 'goods_not_received' as const,
    };

    it('should validate valid dispute', () => {
      const result = createDisputeSchema.safeParse(validData);
      expect(result.success).toBe(true);
    });

    it('should accept optional description', () => {
      const result = createDisputeSchema.safeParse({
        ...validData,
        description: 'Goods not received after 2 weeks',
      });
      expect(result.success).toBe(true);
    });

    it('should reject description over 1000 characters', () => {
      const result = createDisputeSchema.safeParse({
        ...validData,
        description: 'a'.repeat(1001),
      });
      expect(result.success).toBe(false);
    });

    it('should reject invalid transaction ID', () => {
      const result = createDisputeSchema.safeParse({
        ...validData,
        transaction_id: 'invalid',
      });
      expect(result.success).toBe(false);
    });
  });

  describe('kycVerificationSchema', () => {
    const validData = {
      tier: 'tier_2' as const,
      identity_document: {
        type: 'nid' as const,
        number: '12345678901',
        image_url: 'https://example.com/doc.jpg',
      },
    };

    it('should validate valid KYC verification', () => {
      const result = kycVerificationSchema.safeParse(validData);
      expect(result.success).toBe(true);
    });

    it('should accept tier 3 with address verification', () => {
      const result = kycVerificationSchema.safeParse({
        tier: 'tier_3' as const,
        identity_document: validData.identity_document,
        address_verification: {
          street: '123 Main St',
          city: 'Lagos',
          state: 'Lagos',
          postal_code: '100001',
          document_url: 'https://example.com/utility.jpg',
        },
      });
      expect(result.success).toBe(true);
    });

    it('should reject invalid document type', () => {
      const result = kycVerificationSchema.safeParse({
        ...validData,
        identity_document: {
          ...validData.identity_document,
          type: 'invalid' as any,
        },
      });
      expect(result.success).toBe(false);
    });
  });

  describe('paginationQuerySchema', () => {
    it('should use default values', () => {
      const result = paginationQuerySchema.safeParse({});
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.page).toBe(1);
        expect(result.data.limit).toBe(20);
        expect(result.data.sort_order).toBe('desc');
      }
    });

    it('should validate custom pagination values', () => {
      const result = paginationQuerySchema.safeParse({
        page: '2',
        limit: '50',
        sort_by: 'created_at',
        sort_order: 'asc' as const,
      });
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.page).toBe(2);
        expect(result.data.limit).toBe(50);
      }
    });

    it('should coerce string numbers to integers', () => {
      const result = paginationQuerySchema.safeParse({
        page: '3',
        limit: '30',
      });
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.page).toBe(3);
        expect(result.data.limit).toBe(30);
      }
    });

    it('should reject limit over 100', () => {
      const result = paginationQuerySchema.safeParse({
        limit: '150',
      });
      expect(result.success).toBe(false);
    });
  });

  describe('transactionQuerySchema', () => {
    it('should validate with pagination defaults', () => {
      const result = transactionQuerySchema.safeParse({});
      expect(result.success).toBe(true);
    });

    it('should validate with filters', () => {
      const result = transactionQuerySchema.safeParse({
        status: 'held',
        gateway: 'paystack',
        seller_id: '550e8400-e29b-41d4-a716-446655440000',
      });
      expect(result.success).toBe(true);
    });

    it('should accept date range filters', () => {
      const result = transactionQuerySchema.safeParse({
        start_date: '2024-01-01',
        end_date: '2024-12-31',
      });
      expect(result.success).toBe(true);
    });
  });

  describe('payoutQuerySchema', () => {
    it('should validate with status filter', () => {
      const result = payoutQuerySchema.safeParse({
        status: 'pending',
      });
      expect(result.success).toBe(true);
    });
  });

  describe('disputeQuerySchema', () => {
    it('should validate with transaction filter', () => {
      const result = disputeQuerySchema.safeParse({
        transaction_id: '550e8400-e29b-41d4-a716-446655440000',
      });
      expect(result.success).toBe(true);
    });
  });
});
