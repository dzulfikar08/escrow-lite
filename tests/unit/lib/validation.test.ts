import { describe, it, expect } from 'vitest';
import {
  registerSellerSchema,
  loginSellerSchema,
  createTransactionSchema,
  markAsShippedSchema,
  createBankAccountSchema,
  addDisputeEvidenceSchema,
  type RegisterSellerInput,
  type LoginSellerInput,
  type CreateTransactionInput,
} from '../../../src/lib/validation';

describe('Validation Schemas', () => {
  describe('registerSellerSchema', () => {
    const validData = {
      name: 'Test Business',
      email: 'test@example.com',
      password: 'Password123',
    };

    it('should validate valid seller registration', () => {
      const result = registerSellerSchema.safeParse(validData);
      expect(result.success).toBe(true);
    });

    it('should reject invalid email', () => {
      const result = registerSellerSchema.safeParse({
        ...validData,
        email: 'invalid-email',
      });
      expect(result.success).toBe(false);
    });

    it('should reject weak password', () => {
      const result = registerSellerSchema.safeParse({
        ...validData,
        password: 'weak',
      });
      expect(result.success).toBe(false);
    });

    it('should reject name less than 3 characters', () => {
      const result = registerSellerSchema.safeParse({
        ...validData,
        name: 'AB',
      });
      expect(result.success).toBe(false);
    });

    it('should reject name more than 100 characters', () => {
      const result = registerSellerSchema.safeParse({
        ...validData,
        name: 'A'.repeat(101),
      });
      expect(result.success).toBe(false);
    });

    it('should reject password without uppercase', () => {
      const result = registerSellerSchema.safeParse({
        ...validData,
        password: 'password123',
      });
      expect(result.success).toBe(false);
    });

    it('should reject password without lowercase', () => {
      const result = registerSellerSchema.safeParse({
        ...validData,
        password: 'PASSWORD123',
      });
      expect(result.success).toBe(false);
    });

    it('should reject password without number', () => {
      const result = registerSellerSchema.safeParse({
        ...validData,
        password: 'Password',
      });
      expect(result.success).toBe(false);
    });
  });

  describe('loginSellerSchema', () => {
    it('should validate valid login', () => {
      const result = loginSellerSchema.safeParse({
        email: 'test@example.com',
        password: 'password123',
      });
      expect(result.success).toBe(true);
    });

    it('should reject invalid email', () => {
      const result = loginSellerSchema.safeParse({
        email: 'invalid',
        password: 'password123',
      });
      expect(result.success).toBe(false);
    });

    it('should reject empty password', () => {
      const result = loginSellerSchema.safeParse({
        email: 'test@example.com',
        password: '',
      });
      expect(result.success).toBe(false);
    });
  });

  describe('createTransactionSchema', () => {
    const validData = {
      buyer_email: 'buyer@example.com',
      buyer_phone: '+628123456789',
      amount: 100000,
    };

    it('should validate valid transaction', () => {
      const result = createTransactionSchema.safeParse(validData);
      expect(result.success).toBe(true);
    });

    it('should reject invalid buyer email', () => {
      const result = createTransactionSchema.safeParse({
        ...validData,
        buyer_email: 'invalid-email',
      });
      expect(result.success).toBe(false);
    });

    it('should reject non-positive amount', () => {
      const result = createTransactionSchema.safeParse({
        ...validData,
        amount: 0,
      });
      expect(result.success).toBe(false);
    });

    it('should reject negative amount', () => {
      const result = createTransactionSchema.safeParse({
        ...validData,
        amount: -1000,
      });
      expect(result.success).toBe(false);
    });

    it('should accept optional auto_release_days', () => {
      const result = createTransactionSchema.safeParse({
        ...validData,
        auto_release_days: 7,
      });
      expect(result.success).toBe(true);
    });

    it('should accept optional metadata', () => {
      const result = createTransactionSchema.safeParse({
        ...validData,
        metadata: { order_id: '12345' },
      });
      expect(result.success).toBe(true);
    });

    it('should reject non-positive auto_release_days', () => {
      const result = createTransactionSchema.safeParse({
        ...validData,
        auto_release_days: 0,
      });
      expect(result.success).toBe(false);
    });

    it('should reject non-integer auto_release_days', () => {
      const result = createTransactionSchema.safeParse({
        ...validData,
        auto_release_days: 7.5,
      });
      expect(result.success).toBe(false);
    });
  });

  describe('markAsShippedSchema', () => {
    it('should validate valid transaction ID', () => {
      const result = markAsShippedSchema.safeParse({
        transaction_id: '550e8400-e29b-41d4-a716-446655440000',
      });
      expect(result.success).toBe(true);
    });

    it('should reject invalid transaction ID', () => {
      const result = markAsShippedSchema.safeParse({
        transaction_id: 'invalid-uuid',
      });
      expect(result.success).toBe(false);
    });

    it('should reject empty transaction ID', () => {
      const result = markAsShippedSchema.safeParse({
        transaction_id: '',
      });
      expect(result.success).toBe(false);
    });
  });

  describe('createBankAccountSchema', () => {
    const validData = {
      bank_code: 'BCA',
      account_number: '1234567890',
      account_name: 'John Doe',
    };

    it('should validate valid bank account', () => {
      const result = createBankAccountSchema.safeParse(validData);
      expect(result.success).toBe(true);
    });

    it('should reject empty bank code', () => {
      const result = createBankAccountSchema.safeParse({
        ...validData,
        bank_code: '',
      });
      expect(result.success).toBe(false);
    });

    it('should reject empty account number', () => {
      const result = createBankAccountSchema.safeParse({
        ...validData,
        account_number: '',
      });
      expect(result.success).toBe(false);
    });

    it('should reject empty account name', () => {
      const result = createBankAccountSchema.safeParse({
        ...validData,
        account_name: '',
      });
      expect(result.success).toBe(false);
    });
  });

  describe('addDisputeEvidenceSchema', () => {
    const validData = {
      dispute_id: '550e8400-e29b-41d4-a716-446655440000',
      file_url: 'https://example.com/evidence.jpg',
    };

    it('should validate valid evidence', () => {
      const result = addDisputeEvidenceSchema.safeParse(validData);
      expect(result.success).toBe(true);
    });

    it('should accept optional description', () => {
      const result = addDisputeEvidenceSchema.safeParse({
        ...validData,
        description: 'Photo of damaged item',
      });
      expect(result.success).toBe(true);
    });

    it('should reject invalid dispute ID', () => {
      const result = addDisputeEvidenceSchema.safeParse({
        ...validData,
        dispute_id: 'invalid-uuid',
      });
      expect(result.success).toBe(false);
    });

    it('should reject invalid file URL', () => {
      const result = addDisputeEvidenceSchema.safeParse({
        ...validData,
        file_url: 'not-a-url',
      });
      expect(result.success).toBe(false);
    });
  });

  describe('API Response Schemas', () => {
    it('should have correct API error response structure', () => {
      const { apiErrorSchema } = require('../../../src/lib/validation');
      const mockErrorResponse = {
        success: false,
        error: {
          message: 'Test error',
          code: 'TEST_ERROR',
          details: {},
        },
        meta: {
          request_id: '550e8400-e29b-41d4-a716-446655440000',
          timestamp: '2026-03-18T00:00:00.000Z',
        },
      };
      const result = apiErrorSchema.safeParse(mockErrorResponse);
      expect(result.success).toBe(true);
    });
  });
});
