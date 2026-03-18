import { describe, it, expect } from 'vitest';
import {
  AppError,
  AuthenticationError,
  ValidationError,
  NotFoundError,
  ConflictError,
  RateLimitError,
  AuthorizationError,
  PaymentError,
  handleError,
  isAppError,
} from '../../../src/lib/errors';

describe('Error Classes', () => {
  describe('AppError', () => {
    it('should create base error with default values', () => {
      const error = new AppError('Test error');
      expect(error.message).toBe('Test error');
      expect(error.statusCode).toBe(500);
      expect(error.name).toBe('AppError');
    });

    it('should create error with custom status code', () => {
      const error = new AppError('Test error', 400);
      expect(error.statusCode).toBe(400);
    });

    it('should create error with custom code', () => {
      const error = new AppError('Test error', 400, 'TEST_ERROR');
      expect(error.code).toBe('TEST_ERROR');
    });

    it('should serialize to JSON', () => {
      const error = new AppError('Test error', 400, 'TEST_ERROR');
      const json = error.toJSON();
      expect(json).toEqual({
        error: {
          message: 'Test error',
          code: 'TEST_ERROR',
          statusCode: 400,
        },
      });
    });
  });

  describe('AuthenticationError', () => {
    it('should create authentication error with default message', () => {
      const error = new AuthenticationError();
      expect(error.message).toBe('Authentication required');
      expect(error.statusCode).toBe(401);
      expect(error.code).toBe('AUTHENTICATION_ERROR');
    });

    it('should create authentication error with custom message', () => {
      const error = new AuthenticationError('Invalid token');
      expect(error.message).toBe('Invalid token');
      expect(error.statusCode).toBe(401);
    });
  });

  describe('ValidationError', () => {
    it('should create validation error without fields', () => {
      const error = new ValidationError('Validation failed');
      expect(error.message).toBe('Validation failed');
      expect(error.statusCode).toBe(400);
      expect(error.fields).toBeUndefined();
    });

    it('should create validation error with fields', () => {
      const fields = { email: 'Invalid email', password: 'Too short' };
      const error = new ValidationError('Validation failed', fields);
      expect(error.fields).toEqual(fields);
    });

    it('should serialize to JSON with fields', () => {
      const fields = { email: 'Invalid email' };
      const error = new ValidationError('Validation failed', fields);
      const json = error.toJSON();
      expect(json.error.fields).toEqual(fields);
    });
  });

  describe('NotFoundError', () => {
    it('should create not found error with default message', () => {
      const error = new NotFoundError();
      expect(error.message).toBe('Resource not found');
      expect(error.statusCode).toBe(404);
    });

    it('should create not found error with custom message', () => {
      const error = new NotFoundError('Seller not found');
      expect(error.message).toBe('Seller not found');
    });
  });

  describe('ConflictError', () => {
    it('should create conflict error', () => {
      const error = new ConflictError('Email already exists');
      expect(error.message).toBe('Email already exists');
      expect(error.statusCode).toBe(409);
      expect(error.code).toBe('CONFLICT_ERROR');
    });
  });

  describe('RateLimitError', () => {
    it('should create rate limit error with defaults', () => {
      const error = new RateLimitError();
      expect(error.message).toBe('Rate limit exceeded');
      expect(error.statusCode).toBe(429);
      expect(error.retryAfter).toBeUndefined();
    });

    it('should create rate limit error with custom values', () => {
      const error = new RateLimitError('Too many requests', 60);
      expect(error.message).toBe('Too many requests');
      expect(error.retryAfter).toBe(60);
    });

    it('should serialize to JSON with retryAfter', () => {
      const error = new RateLimitError('Too many requests', 60);
      const json = error.toJSON();
      expect(json.error.retryAfter).toBe(60);
    });
  });

  describe('AuthorizationError', () => {
    it('should create authorization error', () => {
      const error = new AuthorizationError();
      expect(error.message).toBe('Insufficient permissions');
      expect(error.statusCode).toBe(403);
    });
  });

  describe('PaymentError', () => {
    it('should create payment error without gateway code', () => {
      const error = new PaymentError('Payment failed');
      expect(error.message).toBe('Payment failed');
      expect(error.statusCode).toBe(402);
      expect(error.gatewayCode).toBeUndefined();
    });

    it('should create payment error with gateway code', () => {
      const error = new PaymentError('Payment failed', 'INSUFFICIENT_FUNDS');
      expect(error.gatewayCode).toBe('INSUFFICIENT_FUNDS');
    });

    it('should serialize to JSON with gatewayCode', () => {
      const error = new PaymentError('Payment failed', 'DECLINED');
      const json = error.toJSON();
      expect(json.error.gatewayCode).toBe('DECLINED');
    });
  });

  describe('handleError', () => {
    it('should return AppError as-is', () => {
      const originalError = new ValidationError('Test');
      const handled = handleError(originalError);
      expect(handled).toBe(originalError);
    });

    it('should convert Zod error to ValidationError', () => {
      const zodError = {
        issues: [
          { path: ['email'], message: 'Invalid email' },
          { path: ['password'], message: 'Too short' },
        ],
      };
      const handled = handleError(zodError);
      expect(handled).toBeInstanceOf(ValidationError);
      expect(handled.fields).toEqual({
        email: 'Invalid email',
        password: 'Too short',
      });
    });

    it('should convert Error to AppError', () => {
      const error = new Error('Something went wrong');
      const handled = handleError(error);
      expect(handled).toBeInstanceOf(AppError);
      expect(handled.message).toBe('Something went wrong');
    });

    it('should convert unknown to AppError', () => {
      const handled = handleError('unknown error');
      expect(handled).toBeInstanceOf(AppError);
      expect(handled.message).toBe('An unexpected error occurred');
    });
  });

  describe('isAppError', () => {
    it('should return true for AppError instances', () => {
      const error = new ValidationError('Test');
      expect(isAppError(error)).toBe(true);
    });

    it('should return false for non-AppError', () => {
      const error = new Error('Test');
      expect(isAppError(error)).toBe(false);
    });
  });
});
