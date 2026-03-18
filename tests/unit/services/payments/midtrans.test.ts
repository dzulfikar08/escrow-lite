import { describe, it, expect, beforeEach, vi } from 'vitest';
import { MidtransService } from '@/services/payments/midtrans';
import type { Transaction } from '@/services/escrow/types';

// Mock fetch globally
const mockFetch = vi.fn();
global.fetch = mockFetch;

describe('MidtransService', () => {
  let service: MidtransService;
  const mockServerKey = 'SB-Mid-server-TEST123';
  const mockApiUrl = 'https://app.sandbox.midtrans.com';

  beforeEach(() => {
    vi.clearAllMocks();
    service = new MidtransService(mockServerKey, mockApiUrl);
  });

  describe('createPayment', () => {
    it('should create payment with correct Midtrans API format', async () => {
      const transaction: Transaction = {
        id: 'tx_test123',
        seller_id: 'seller_1',
        buyer_email: 'buyer@example.com',
        buyer_phone: '+628123456789',
        amount: 500000,
        fee_rate: 0.01,
        fee_amount: 5000,
        net_amount: 495000,
        gateway: 'midtrans',
        status: 'pending',
        auto_release_days: 7,
        auto_release_at: '2025-03-25T10:00:00.000Z',
        absolute_expire_at: '2025-04-01T10:00:00.000Z',
        created_at: '2025-03-18T10:00:00.000Z',
        updated_at: '2025-03-18T10:00:00.000Z',
      };

      const mockResponse = {
        token: 'sbpa2_abc123def456',
        redirect_url: 'https://app.sandbox.midtrans.com/payment-link/sbpa2_abc123def456',
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => mockResponse,
      } as Response);

      const result = await service.createPayment(transaction);

      expect(mockFetch).toHaveBeenCalledTimes(1);
      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining('/v2/snap'),
        expect.objectContaining({
          method: 'POST',
          headers: expect.objectContaining({
            'Content-Type': 'application/json',
            Authorization: expect.stringContaining('Basic'),
          }),
        })
      );

      expect(result.token).toBe(mockResponse.token);
      expect(result.redirectUrl).toBe(mockResponse.redirect_url);
    });

    it('should format order ID as escrow-{transaction_id}', async () => {
      const transaction: Transaction = {
        id: 'tx_test123',
        seller_id: 'seller_1',
        buyer_email: 'buyer@example.com',
        buyer_phone: '+628123456789',
        amount: 500000,
        fee_rate: 0.01,
        fee_amount: 5000,
        net_amount: 495000,
        gateway: 'midtrans',
        status: 'pending',
        created_at: '2025-03-18T10:00:00.000Z',
        updated_at: '2025-03-18T10:00:00.000Z',
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          token: 'sbpa2_abc123',
          redirect_url: 'https://app.sandbox.midtrans.com/payment-link/test',
        }),
      } as Response);

      await service.createPayment(transaction);

      const callArgs = mockFetch.mock.calls[0];
      const body = JSON.parse(callArgs[1].body);

      expect(body.transaction_details.order_id).toBe('escrow-tx_test123');
    });

    it('should include transaction details in request body', async () => {
      const transaction: Transaction = {
        id: 'tx_test123',
        seller_id: 'seller_1',
        buyer_email: 'buyer@example.com',
        buyer_phone: '+628123456789',
        amount: 500000,
        fee_rate: 0.01,
        fee_amount: 5000,
        net_amount: 495000,
        gateway: 'midtrans',
        status: 'pending',
        created_at: '2025-03-18T10:00:00.000Z',
        updated_at: '2025-03-18T10:00:00.000Z',
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          token: 'sbpa2_abc123',
          redirect_url: 'https://app.sandbox.midtrans.com/payment-link/test',
        }),
      } as Response);

      await service.createPayment(transaction);

      const callArgs = mockFetch.mock.calls[0];
      const body = JSON.parse(callArgs[1].body);

      expect(body.transaction_details).toEqual({
        order_id: 'escrow-tx_test123',
        gross_amount: 500000,
      });
    });

    it('should include buyer details in customer_details', async () => {
      const transaction: Transaction = {
        id: 'tx_test123',
        seller_id: 'seller_1',
        buyer_email: 'buyer@example.com',
        buyer_phone: '+628123456789',
        amount: 500000,
        fee_rate: 0.01,
        fee_amount: 5000,
        net_amount: 495000,
        gateway: 'midtrans',
        status: 'pending',
        created_at: '2025-03-18T10:00:00.000Z',
        updated_at: '2025-03-18T10:00:00.000Z',
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          token: 'sbpa2_abc123',
          redirect_url: 'https://app.sandbox.midtrans.com/payment-link/test',
        }),
      } as Response);

      await service.createPayment(transaction);

      const callArgs = mockFetch.mock.calls[0];
      const body = JSON.parse(callArgs[1].body);

      expect(body.customer_details).toEqual({
        email: 'buyer@example.com',
        phone: '+628123456789',
      });
    });

    it('should include metadata in request body', async () => {
      const transaction: Transaction = {
        id: 'tx_test123',
        seller_id: 'seller_1',
        buyer_email: 'buyer@example.com',
        buyer_phone: '+628123456789',
        amount: 500000,
        fee_rate: 0.01,
        fee_amount: 5000,
        net_amount: 495000,
        gateway: 'midtrans',
        status: 'pending',
        metadata: {
          seller_id: 'seller_1',
          transaction_id: 'tx_test123',
        },
        created_at: '2025-03-18T10:00:00.000Z',
        updated_at: '2025-03-18T10:00:00.000Z',
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          token: 'sbpa2_abc123',
          redirect_url: 'https://app.sandbox.midtrans.com/payment-link/test',
        }),
      } as Response);

      await service.createPayment(transaction);

      const callArgs = mockFetch.mock.calls[0];
      const body = JSON.parse(callArgs[1].body);

      expect(body.custom_field1).toBe('seller_1');
      expect(body.custom_field2).toBe('tx_test123');
    });

    it('should throw error when API request fails', async () => {
      const transaction: Transaction = {
        id: 'tx_test123',
        seller_id: 'seller_1',
        buyer_email: 'buyer@example.com',
        buyer_phone: '+628123456789',
        amount: 500000,
        fee_rate: 0.01,
        fee_amount: 5000,
        net_amount: 495000,
        gateway: 'midtrans',
        status: 'pending',
        created_at: '2025-03-18T10:00:00.000Z',
        updated_at: '2025-03-18T10:00:00.000Z',
      };

      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 500,
        statusText: 'Internal Server Error',
      } as Response);

      await expect(service.createPayment(transaction)).rejects.toThrow(
        'Midtrans API error: 500 Internal Server Error'
      );
    });

    it('should throw error when response is invalid', async () => {
      const transaction: Transaction = {
        id: 'tx_test123',
        seller_id: 'seller_1',
        buyer_email: 'buyer@example.com',
        buyer_phone: '+628123456789',
        amount: 500000,
        fee_rate: 0.01,
        fee_amount: 5000,
        net_amount: 495000,
        gateway: 'midtrans',
        status: 'pending',
        created_at: '2025-03-18T10:00:00.000Z',
        updated_at: '2025-03-18T10:00:00.000Z',
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ invalid: 'response' }),
      } as Response);

      await expect(service.createPayment(transaction)).rejects.toThrow(
        'Invalid Midtrans response'
      );
    });

    it('should use correct authorization header with server key', async () => {
      const transaction: Transaction = {
        id: 'tx_test123',
        seller_id: 'seller_1',
        buyer_email: 'buyer@example.com',
        buyer_phone: '+628123456789',
        amount: 500000,
        fee_rate: 0.01,
        fee_amount: 5000,
        net_amount: 495000,
        gateway: 'midtrans',
        status: 'pending',
        created_at: '2025-03-18T10:00:00.000Z',
        updated_at: '2025-03-18T10:00:00.000Z',
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          token: 'sbpa2_abc123',
          redirect_url: 'https://app.sandbox.midtrans.com/payment-link/test',
        }),
      } as Response);

      await service.createPayment(transaction);

      const callArgs = mockFetch.mock.calls[0];
      const authHeader = callArgs[1].headers.Authorization;

      // Midtrans uses Basic Auth with base64 encoded serverKey:
      expect(authHeader).toMatch(/^Basic /);
    });
  });

  describe('verifyWebhook', () => {
    it('should verify valid webhook signature', async () => {
      const orderId = 'escrow-tx_test123';
      const statusCode = '200';
      const grossAmount = '500000.00';

      // Create valid signature
      const signature = await service['createSignature'](
        orderId,
        statusCode,
        grossAmount
      );

      const isValid = await service.verifyWebhook(signature, {
        order_id: orderId,
        status_code: statusCode,
        gross_amount: grossAmount,
      });

      expect(isValid).toBe(true);
    });

    it('should reject invalid webhook signature', async () => {
      const isValid = await service.verifyWebhook('invalid-signature', {
        order_id: 'escrow-tx_test123',
        status_code: '200',
        gross_amount: '500000.00',
      });

      expect(isValid).toBe(false);
    });

    it('should handle missing signature', async () => {
      const isValid = await service.verifyWebhook('', {
        order_id: 'escrow-tx_test123',
        status_code: '200',
        gross_amount: '500000.00',
      });

      expect(isValid).toBe(false);
    });

    it('should handle tampered data', async () => {
      const orderId = 'escrow-tx_test123';
      const statusCode = '200';
      const grossAmount = '500000.00';

      // Create signature for original data
      const signature = await service['createSignature'](
        orderId,
        statusCode,
        grossAmount
      );

      // Try to verify with different amount
      const isValid = await service.verifyWebhook(signature, {
        order_id: orderId,
        status_code: statusCode,
        gross_amount: '999999.99',
      });

      expect(isValid).toBe(false);
    });
  });

  describe('processNotification', () => {
    it('should throw error without database instance', async () => {
      const notification = {
        transaction_id: 'tx_test123',
        transaction_status: 'capture',
        fraud_status: 'accept',
        order_id: 'escrow-tx_test123',
        gross_amount: '500000.00',
        status_code: '200',
      };

      await expect(service.processNotification(notification)).rejects.toThrow(
        'Database instance required'
      );
    });

    it('should validate order_id format', async () => {
      const serviceWithDb = new MidtransService(
        mockServerKey,
        mockApiUrl,
        {} as D1Database
      );

      const notification = {
        transaction_id: 'tx_test123',
        transaction_status: 'capture',
        order_id: 'invalid-format',
        gross_amount: '500000.00',
        status_code: '200',
      };

      await expect(
        serviceWithDb.processNotification(notification)
      ).rejects.toThrow('Invalid order_id format');
    });

    it('should extract transaction ID from order_id format', async () => {
      const serviceWithDb = new MidtransService(
        mockServerKey,
        mockApiUrl,
        {} as D1Database
      );

      // Mock the escrow and ledger services
      const mockEscrowEngine = {
        getTransaction: vi.fn().mockResolvedValue({
          id: 'tx_abc456',
          seller_id: 'seller_1',
          status: 'pending',
          net_amount: 495000,
        }),
        markAsFunded: vi.fn().mockResolvedValue({ id: 'tx_abc456' }),
        markAsHeld: vi.fn().mockResolvedValue({ id: 'tx_abc456' }),
      };

      const mockLedgerService = {
        recordHold: vi.fn().mockResolvedValue({}),
      };

      Object.assign(serviceWithDb, {
        getEscrowEngine: () => mockEscrowEngine,
        getLedgerService: () => mockLedgerService,
      });

      const notification = {
        transaction_id: 'midtrans-tx-123',
        transaction_status: 'settlement',
        fraud_status: 'accept',
        order_id: 'escrow-tx_abc456',
        gross_amount: '500000.00',
        status_code: '200',
      };

      const result = await serviceWithDb.processNotification(notification);

      expect(result.transactionId).toBe('tx_abc456');
      expect(mockEscrowEngine.markAsFunded).toHaveBeenCalledWith(
        'tx_abc456',
        'midtrans-tx-123'
      );
    });
  });

  describe('getStatus', () => {
    it('should fetch transaction status from Midtrans API', async () => {
      const orderId = 'escrow-tx_test123';

      const mockStatusResponse = {
        transaction_status: 'settlement',
        fraud_status: 'accept',
        gross_amount: '500000.00',
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => mockStatusResponse,
      } as Response);

      const status = await service.getStatus(orderId);

      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining(`/v2/${orderId}/status`),
        expect.objectContaining({
          method: 'GET',
          headers: expect.objectContaining({
            Authorization: expect.stringContaining('Basic'),
          }),
        })
      );

      expect(status).toEqual(mockStatusResponse);
    });

    it('should handle API errors', async () => {
      const orderId = 'escrow-tx_test123';

      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 404,
        statusText: 'Not Found',
      } as Response);

      await expect(service.getStatus(orderId)).rejects.toThrow(
        'Midtrans API error: 404 Not Found'
      );
    });
  });
});
