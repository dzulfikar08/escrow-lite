import { describe, it, expect } from 'vitest';
import {
  AppError,
  AuthenticationError,
  ValidationError,
  NotFoundError,
  ConflictError,
  RateLimitError,
  handleError,
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

    it('should serialize to JSON with meta.request_id and meta.timestamp', () => {
      const error = new AppError('Test error', 400, 'TEST_ERROR');
      const json = error.toJSON();
      expect(json).toHaveProperty('error');
      expect(json).toHaveProperty('meta');
      expect(json.error).toEqual({
        message: 'Test error',
        code: 'TEST_ERROR',
        details: {},
      });
      expect(json.meta).toHaveProperty('request_id');
      expect(json.meta).toHaveProperty('timestamp');
      expect(typeof json.meta.request_id).toBe('string');
      expect(typeof json.meta.timestamp).toBe('string');
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

    it('should serialize to JSON with fields in details', () => {
      const fields = { email: 'Invalid email' };
      const error = new ValidationError('Validation failed', fields);
      const json = error.toJSON();
      expect(json.error.details).toEqual({ fields });
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

    it('should serialize to JSON with retryAfter in details', () => {
      const error = new RateLimitError('Too many requests', 60);
      const json = error.toJSON();
      expect(json.error.details).toEqual({ retryAfter: 60 });
    });
  });

  describe('handleError', () => {
    it('should return Response object for AppError', () => {
      const originalError = new ValidationError('Test');
      const response = handleError(originalError);
      expect(response).toBeInstanceOf(Response);
      expect(response.status).toBe(400);
    });

    it('should convert Zod error to ValidationError Response', () => {
      const zodError = {
        issues: [
          { path: ['email'], message: 'Invalid email' },
          { path: ['password'], message: 'Too short' },
        ],
      };
      const response = handleError(zodError);
      expect(response).toBeInstanceOf(Response);
      expect(response.status).toBe(400);
    });

    it('should convert Error to AppError Response', () => {
      const error = new Error('Something went wrong');
      const response = handleError(error);
      expect(response).toBeInstanceOf(Response);
      expect(response.status).toBe(500);
    });

    it('should convert unknown to AppError Response', () => {
      const response = handleError('unknown error');
      expect(response).toBeInstanceOf(Response);
      expect(response.status).toBe(500);
    });

    it('should return Response with correct JSON structure', async () => {
      const error = new ValidationError('Validation failed', { email: 'Invalid email' });
      const response = handleError(error);
      const json = await response.json();

      expect(json).toHaveProperty('error');
      expect(json).toHaveProperty('meta');
      expect(json.error).toHaveProperty('message');
      expect(json.error).toHaveProperty('code');
      expect(json.error).toHaveProperty('details');
      expect(json.meta).toHaveProperty('request_id');
      expect(json.meta).toHaveProperty('timestamp');
    });
  });
});
