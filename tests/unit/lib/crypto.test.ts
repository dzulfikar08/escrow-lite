import { describe, it, expect } from 'vitest';
import {
  createHmacSignatureAsync,
  verifyHmacSignature,
  createMidtransSignature,
  verifyMidtransSignature,
} from '@/lib/crypto';

describe('Crypto Utilities', () => {
  describe('createHmacSignatureAsync', () => {
    it('should create a consistent SHA512 HMAC signature', async () => {
      const key = 'test-secret-key';
      const data = 'test-data-to-sign';

      const signature1 = await createHmacSignatureAsync(key, data);
      const signature2 = await createHmacSignatureAsync(key, data);

      expect(signature1).toBe(signature2);
      expect(signature1).toMatch(/^[a-f0-9]{128}$/); // SHA512 produces 128 hex chars
    });

    it('should create different signatures for different data', async () => {
      const key = 'test-secret-key';

      const signature1 = await createHmacSignatureAsync(key, 'data-one');
      const signature2 = await createHmacSignatureAsync(key, 'data-two');

      expect(signature1).not.toBe(signature2);
    });

    it('should create different signatures for different keys', async () => {
      const data = 'test-data';

      const signature1 = await createHmacSignatureAsync('key-one', data);
      const signature2 = await createHmacSignatureAsync('key-two', data);

      expect(signature1).not.toBe(signature2);
    });

    it('should handle empty strings', async () => {
      const signature = await createHmacSignatureAsync('key', '');
      expect(signature).toMatch(/^[a-f0-9]{128}$/);
    });
  });

  describe('verifyHmacSignature', () => {
    it('should verify a correct signature', async () => {
      const key = 'test-secret-key';
      const data = 'test-data-to-sign';

      const signature = await createHmacSignatureAsync(key, data);
      const isValid = await verifyHmacSignature(key, data, signature);

      expect(isValid).toBe(true);
    });

    it('should reject an incorrect signature', async () => {
      const key = 'test-secret-key';
      const data = 'test-data-to-sign';

      const isValid = await verifyHmacSignature(key, data, 'invalid-signature');

      expect(isValid).toBe(false);
    });

    it('should reject signature with different data', async () => {
      const key = 'test-secret-key';

      const signature = await createHmacSignatureAsync(key, 'original-data');
      const isValid = await verifyHmacSignature(key, 'modified-data', signature);

      expect(isValid).toBe(false);
    });

    it('should reject signature with different key', async () => {
      const data = 'test-data-to-sign';

      const signature = await createHmacSignatureAsync('key-one', data);
      const isValid = await verifyHmacSignature('key-two', data, signature);

      expect(isValid).toBe(false);
    });

    it('should be timing-safe for different length signatures', async () => {
      const key = 'test-secret-key';
      const data = 'test-data';

      const validSignature = await createHmacSignatureAsync(key, data);
      const shortSignature = validSignature.slice(0, 64);

      const isValid1 = await verifyHmacSignature(key, data, shortSignature);
      const isValid2 = await verifyHmacSignature(key, data, validSignature);

      expect(isValid1).toBe(false);
      expect(isValid2).toBe(true);
    });
  });

  describe('Midtrans Signature Functions', () => {
    const testServerKey = 'SB-Mid-server-TEST-KEY-123456789';

    describe('createMidtransSignature', () => {
      it('should create signature with correct format: orderId + statusCode + grossAmount', async () => {
        const orderId = 'escrow-tx_1234567890';
        const statusCode = '200';
        const grossAmount = '500000.00';

        const signature = await createMidtransSignature(
          orderId,
          statusCode,
          grossAmount,
          testServerKey
        );

        expect(signature).toMatch(/^[a-f0-9]{128}$/);
      });

      it('should create consistent signatures for same inputs', async () => {
        const orderId = 'escrow-tx_1234567890';
        const statusCode = '200';
        const grossAmount = '500000.00';

        const signature1 = await createMidtransSignature(
          orderId,
          statusCode,
          grossAmount,
          testServerKey
        );
        const signature2 = await createMidtransSignature(
          orderId,
          statusCode,
          grossAmount,
          testServerKey
        );

        expect(signature1).toBe(signature2);
      });

      it('should handle different order IDs', async () => {
        const statusCode = '200';
        const grossAmount = '500000.00';

        const signature1 = await createMidtransSignature(
          'order-1',
          statusCode,
          grossAmount,
          testServerKey
        );
        const signature2 = await createMidtransSignature(
          'order-2',
          statusCode,
          grossAmount,
          testServerKey
        );

        expect(signature1).not.toBe(signature2);
      });

      it('should handle different status codes', async () => {
        const orderId = 'escrow-tx_1234567890';
        const grossAmount = '500000.00';

        const signature1 = await createMidtransSignature(
          orderId,
          '200',
          grossAmount,
          testServerKey
        );
        const signature2 = await createMidtransSignature(
          orderId,
          '202',
          grossAmount,
          testServerKey
        );

        expect(signature1).not.toBe(signature2);
      });

      it('should handle different amounts', async () => {
        const orderId = 'escrow-tx_1234567890';
        const statusCode = '200';

        const signature1 = await createMidtransSignature(
          orderId,
          statusCode,
          '100000.00',
          testServerKey
        );
        const signature2 = await createMidtransSignature(
          orderId,
          statusCode,
          '200000.00',
          testServerKey
        );

        expect(signature1).not.toBe(signature2);
      });

      it('should include decimal places in amount', async () => {
        const orderId = 'escrow-tx_1234567890';
        const statusCode = '200';

        const signature1 = await createMidtransSignature(
          orderId,
          statusCode,
          '500000',
          testServerKey
        );
        const signature2 = await createMidtransSignature(
          orderId,
          statusCode,
          '500000.00',
          testServerKey
        );

        expect(signature1).not.toBe(signature2);
      });
    });

    describe('verifyMidtransSignature', () => {
      it('should verify a correct Midtrans signature', async () => {
        const orderId = 'escrow-tx_1234567890';
        const statusCode = '200';
        const grossAmount = '500000.00';

        const signature = await createMidtransSignature(
          orderId,
          statusCode,
          grossAmount,
          testServerKey
        );

        const isValid = await verifyMidtransSignature(
          orderId,
          statusCode,
          grossAmount,
          signature,
          testServerKey
        );

        expect(isValid).toBe(true);
      });

      it('should reject an incorrect Midtrans signature', async () => {
        const orderId = 'escrow-tx_1234567890';
        const statusCode = '200';
        const grossAmount = '500000.00';

        const isValid = await verifyMidtransSignature(
          orderId,
          statusCode,
          grossAmount,
          'invalid-signature',
          testServerKey
        );

        expect(isValid).toBe(false);
      });

      it('should reject signature with wrong order ID', async () => {
        const orderId = 'escrow-tx_1234567890';
        const statusCode = '200';
        const grossAmount = '500000.00';

        const signature = await createMidtransSignature(
          orderId,
          statusCode,
          grossAmount,
          testServerKey
        );

        const isValid = await verifyMidtransSignature(
          'wrong-order-id',
          statusCode,
          grossAmount,
          signature,
          testServerKey
        );

        expect(isValid).toBe(false);
      });

      it('should reject signature with wrong status code', async () => {
        const orderId = 'escrow-tx_1234567890';
        const statusCode = '200';
        const grossAmount = '500000.00';

        const signature = await createMidtransSignature(
          orderId,
          statusCode,
          grossAmount,
          testServerKey
        );

        const isValid = await verifyMidtransSignature(
          orderId,
          '404',
          grossAmount,
          signature,
          testServerKey
        );

        expect(isValid).toBe(false);
      });

      it('should reject signature with wrong amount', async () => {
        const orderId = 'escrow-tx_1234567890';
        const statusCode = '200';
        const grossAmount = '500000.00';

        const signature = await createMidtransSignature(
          orderId,
          statusCode,
          grossAmount,
          testServerKey
        );

        const isValid = await verifyMidtransSignature(
          orderId,
          statusCode,
          '999999.99',
          signature,
          testServerKey
        );

        expect(isValid).toBe(false);
      });

      it('should reject signature with wrong server key', async () => {
        const orderId = 'escrow-tx_1234567890';
        const statusCode = '200';
        const grossAmount = '500000.00';

        const signature = await createMidtransSignature(
          orderId,
          statusCode,
          grossAmount,
          testServerKey
        );

        const isValid = await verifyMidtransSignature(
          orderId,
          statusCode,
          grossAmount,
          signature,
          'wrong-server-key'
        );

        expect(isValid).toBe(false);
      });

      it('should handle real-world Midtrans format', async () => {
        // Test with actual Midtrans order ID format
        const orderId = 'escrow-tx_' + crypto.randomUUID();
        const statusCode = '200';
        const grossAmount = '1500000.00'; // Rp 1,500,000

        const signature = await createMidtransSignature(
          orderId,
          statusCode,
          grossAmount,
          testServerKey
        );

        const isValid = await verifyMidtransSignature(
          orderId,
          statusCode,
          grossAmount,
          signature,
          testServerKey
        );

        expect(isValid).toBe(true);
      });
    });
  });
});
