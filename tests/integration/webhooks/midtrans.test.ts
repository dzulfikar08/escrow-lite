import { describe, it, expect, beforeEach, vi } from 'vitest';
import { MidtransService } from '@/services/payments/midtrans';

const mockFetch = vi.fn();
global.fetch = mockFetch;

describe('Midtrans Webhook Integration', () => {
  let service: MidtransService;
  const mockServerKey = 'SB-Mid-server-TEST123';
  const mockApiUrl = 'https://app.sandbox.midtrans.com';

  beforeEach(() => {
    vi.clearAllMocks();
    service = new MidtransService(mockServerKey, mockApiUrl);
  });

  describe('Webhook signature verification', () => {
    it('should verify valid settlement notification signature', async () => {
      const orderId = 'escrow-tx_settlement_test';
      const statusCode = '200';
      const grossAmount = '500000.00';

      const signature = await service['createSignature'](orderId, statusCode, grossAmount);

      const isValid = await service.verifyWebhook(signature, {
        order_id: orderId,
        status_code: statusCode,
        gross_amount: grossAmount,
      });

      expect(isValid).toBe(true);
    });

    it('should verify valid capture notification signature', async () => {
      const orderId = 'escrow-tx_capture_test';
      const statusCode = '200';
      const grossAmount = '250000.00';

      const signature = await service['createSignature'](orderId, statusCode, grossAmount);

      const isValid = await service.verifyWebhook(signature, {
        order_id: orderId,
        status_code: statusCode,
        gross_amount: grossAmount,
      });

      expect(isValid).toBe(true);
    });

    it('should reject webhook with tampered gross_amount', async () => {
      const orderId = 'escrow-tx_tamper_test';
      const statusCode = '200';
      const originalGrossAmount = '500000.00';

      const signature = await service['createSignature'](orderId, statusCode, originalGrossAmount);

      const isValid = await service.verifyWebhook(signature, {
        order_id: orderId,
        status_code: statusCode,
        gross_amount: '999999.99',
      });

      expect(isValid).toBe(false);
    });

    it('should reject webhook with tampered order_id', async () => {
      const orderId = 'escrow-tx_original';
      const statusCode = '200';
      const grossAmount = '500000.00';

      const signature = await service['createSignature'](orderId, statusCode, grossAmount);

      const isValid = await service.verifyWebhook(signature, {
        order_id: 'escrow-tx_different',
        status_code: statusCode,
        gross_amount: grossAmount,
      });

      expect(isValid).toBe(false);
    });

    it('should reject webhook with tampered status_code', async () => {
      const orderId = 'escrow-tx_code_test';
      const statusCode = '200';
      const grossAmount = '500000.00';

      const signature = await service['createSignature'](orderId, statusCode, grossAmount);

      const isValid = await service.verifyWebhook(signature, {
        order_id: orderId,
        status_code: '404',
        gross_amount: grossAmount,
      });

      expect(isValid).toBe(false);
    });

    it('should reject webhook with empty signature', async () => {
      const isValid = await service.verifyWebhook('', {
        order_id: 'escrow-tx_test',
        status_code: '200',
        gross_amount: '500000.00',
      });

      expect(isValid).toBe(false);
    });

    it('should reject webhook with missing fields', async () => {
      const isValid = await service.verifyWebhook('some-signature', {
        order_id: 'escrow-tx_test',
        status_code: '',
        gross_amount: '',
      });

      expect(isValid).toBe(false);
    });
  });

  describe('Notification payload parsing', () => {
    it('should extract transaction ID from escrow- prefixed order_id', async () => {
      const serviceWithDb = new MidtransService(mockServerKey, mockApiUrl, {} as D1Database);

      const mockEscrowEngine = {
        getTransaction: vi.fn().mockResolvedValue({
          id: 'tx_extracted_id',
          seller_id: 'seller_1',
          status: 'pending',
          net_amount: 495000,
        }),
        markAsFunded: vi.fn().mockResolvedValue({ id: 'tx_extracted_id' }),
        markAsHeld: vi.fn().mockResolvedValue({ id: 'tx_extracted_id' }),
      };

      const mockLedgerService = {
        recordHold: vi.fn().mockResolvedValue({}),
      };

      Object.assign(serviceWithDb, {
        getEscrowEngine: () => mockEscrowEngine,
        getLedgerService: () => mockLedgerService,
      });

      const notification = {
        transaction_id: 'midtrans-tx-abc',
        transaction_status: 'settlement',
        fraud_status: 'accept',
        order_id: 'escrow-tx_extracted_id',
        gross_amount: '500000.00',
        status_code: '200',
      };

      const result = await serviceWithDb.processNotification(notification);

      expect(result.transactionId).toBe('tx_extracted_id');
    });

    it('should reject notification without escrow- prefix in order_id', async () => {
      const serviceWithDb = new MidtransService(mockServerKey, mockApiUrl, {} as D1Database);

      const notification = {
        transaction_id: 'midtrans-tx-abc',
        transaction_status: 'settlement',
        order_id: 'plain-order-123',
        gross_amount: '500000.00',
        status_code: '200',
      };

      await expect(serviceWithDb.processNotification(notification)).rejects.toThrow(
        'Invalid order_id format'
      );
    });

    it('should process settlement notification', async () => {
      const serviceWithDb = new MidtransService(mockServerKey, mockApiUrl, {} as D1Database);

      const mockEscrowEngine = {
        getTransaction: vi.fn().mockResolvedValue({
          id: 'tx_settlement',
          seller_id: 'seller_1',
          status: 'pending',
          net_amount: 495000,
        }),
        markAsFunded: vi.fn().mockResolvedValue({
          id: 'tx_settlement',
          status: 'funded',
          gateway_transaction_id: 'midtrans-tx-settle',
        }),
        markAsHeld: vi.fn().mockResolvedValue({
          id: 'tx_settlement',
          status: 'held',
        }),
      };

      const mockLedgerService = {
        recordHold: vi.fn().mockResolvedValue({}),
      };

      Object.assign(serviceWithDb, {
        getEscrowEngine: () => mockEscrowEngine,
        getLedgerService: () => mockLedgerService,
      });

      const notification = {
        transaction_id: 'midtrans-tx-settle',
        transaction_status: 'settlement',
        fraud_status: 'accept',
        order_id: 'escrow-tx_settlement',
        gross_amount: '500000.00',
        status_code: '200',
      };

      const result = await serviceWithDb.processNotification(notification);

      expect(result.transactionId).toBe('tx_settlement');
      expect(mockEscrowEngine.markAsFunded).toHaveBeenCalledWith(
        'tx_settlement',
        'midtrans-tx-settle'
      );
    });

    it('should process capture notification', async () => {
      const serviceWithDb = new MidtransService(mockServerKey, mockApiUrl, {} as D1Database);

      const mockEscrowEngine = {
        getTransaction: vi.fn().mockResolvedValue({
          id: 'tx_capture',
          seller_id: 'seller_1',
          status: 'pending',
          net_amount: 295000,
        }),
        markAsFunded: vi.fn().mockResolvedValue({
          id: 'tx_capture',
          status: 'funded',
        }),
        markAsHeld: vi.fn().mockResolvedValue({
          id: 'tx_capture',
          status: 'held',
        }),
      };

      const mockLedgerService = {
        recordHold: vi.fn().mockResolvedValue({}),
      };

      Object.assign(serviceWithDb, {
        getEscrowEngine: () => mockEscrowEngine,
        getLedgerService: () => mockLedgerService,
      });

      const notification = {
        transaction_id: 'midtrans-tx-cap',
        transaction_status: 'capture',
        fraud_status: 'accept',
        order_id: 'escrow-tx_capture',
        gross_amount: '300000.00',
        status_code: '200',
      };

      const result = await serviceWithDb.processNotification(notification);

      expect(result.transactionId).toBe('tx_capture');
    });

    it('should handle denied/fraud notification', async () => {
      const serviceWithDb = new MidtransService(mockServerKey, mockApiUrl, {} as D1Database);

      const mockMarkAsFunded = vi.fn();
      const mockEscrowEngine = {
        getTransaction: vi.fn().mockResolvedValue({
          id: 'tx_fraud',
          seller_id: 'seller_1',
          status: 'pending',
          net_amount: 495000,
        }),
        markAsFunded: mockMarkAsFunded,
      };

      Object.assign(serviceWithDb, {
        getEscrowEngine: () => mockEscrowEngine,
        getLedgerService: () => ({ recordHold: vi.fn() }),
      });

      const notification = {
        transaction_id: 'midtrans-tx-fraud',
        transaction_status: 'deny',
        fraud_status: 'deny',
        order_id: 'escrow-tx_fraud',
        gross_amount: '500000.00',
        status_code: '200',
      };

      const result = await serviceWithDb.processNotification(notification);

      expect(result.transactionId).toBe('tx_fraud');
      expect(mockMarkAsFunded).not.toHaveBeenCalled();
    });

    it('should handle pending notification', async () => {
      const serviceWithDb = new MidtransService(mockServerKey, mockApiUrl, {} as D1Database);

      const mockEscrowEngine = {
        getTransaction: vi.fn().mockResolvedValue({
          id: 'tx_pending_webhook',
          seller_id: 'seller_1',
          status: 'pending',
          net_amount: 495000,
        }),
      };

      Object.assign(serviceWithDb, {
        getEscrowEngine: () => mockEscrowEngine,
        getLedgerService: () => ({ recordHold: vi.fn() }),
      });

      const notification = {
        transaction_id: 'midtrans-tx-pending',
        transaction_status: 'pending',
        order_id: 'escrow-tx_pending_webhook',
        gross_amount: '500000.00',
        status_code: '201',
      };

      const result = await serviceWithDb.processNotification(notification);

      expect(result.transactionId).toBe('tx_pending_webhook');
    });

    it('should handle expired notification', async () => {
      const serviceWithDb = new MidtransService(mockServerKey, mockApiUrl, {} as D1Database);

      const mockEscrowEngine = {
        getTransaction: vi.fn().mockResolvedValue({
          id: 'tx_expired_webhook',
          seller_id: 'seller_1',
          status: 'pending',
          net_amount: 495000,
        }),
      };

      Object.assign(serviceWithDb, {
        getEscrowEngine: () => mockEscrowEngine,
        getLedgerService: () => ({ recordHold: vi.fn() }),
      });

      const notification = {
        transaction_id: 'midtrans-tx-expired',
        transaction_status: 'expire',
        order_id: 'escrow-tx_expired_webhook',
        gross_amount: '500000.00',
        status_code: '407',
      };

      const result = await serviceWithDb.processNotification(notification);

      expect(result.transactionId).toBe('tx_expired_webhook');
    });

    it('should reject notification without database instance', async () => {
      const notification = {
        transaction_id: 'midtrans-tx-123',
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
  });

  describe('Webhook response format', () => {
    it('should return 200 status for successful processing', async () => {
      const serviceWithDb = new MidtransService(mockServerKey, mockApiUrl, {} as D1Database);

      const mockEscrowEngine = {
        getTransaction: vi.fn().mockResolvedValue({
          id: 'tx_response_test',
          seller_id: 'seller_1',
          status: 'pending',
          net_amount: 495000,
        }),
        markAsFunded: vi.fn().mockResolvedValue({ id: 'tx_response_test' }),
        markAsHeld: vi.fn().mockResolvedValue({ id: 'tx_response_test' }),
      };

      const mockLedgerService = {
        recordHold: vi.fn().mockResolvedValue({}),
      };

      Object.assign(serviceWithDb, {
        getEscrowEngine: () => mockEscrowEngine,
        getLedgerService: () => mockLedgerService,
      });

      const notification = {
        transaction_id: 'midtrans-tx-resp',
        transaction_status: 'settlement',
        fraud_status: 'accept',
        order_id: 'escrow-tx_response_test',
        gross_amount: '500000.00',
        status_code: '200',
      };

      const result = await serviceWithDb.processNotification(notification);

      expect(result).toHaveProperty('transactionId');
    });
  });
});

// TODO: Add full integration tests with actual webhook endpoint
// These require:
// 1. Running wrangler dev server with test D1 bindings
// 2. Or configuring @cloudflare/vitest-pool-workers
// The test structure below is ready to use once the test environment is configured

/*
describe('POST /api/v1/webhooks/midtrans', () => {
  let testDb: TestDatabase;
  let client: TestClient;

  beforeAll(async () => {
    const env = (globalThis as any).Miniflare?.env as Env | undefined;
    if (!env?.DB) {
      throw new Error('D1 binding not available');
    }
    testDb = new TestDatabase(env.DB);
    await testDb.migrate();
    client = new TestClient();
  });

  afterEach(async () => {
    await testDb.reset();
  });

  it('should process valid payment notification', async () => {
    const seller = await testDb.createSeller();
    const tx = await testDb.createTransaction(seller.id, { status: 'pending' });
    const signature = await createMidtransSignature(tx.id, '200', '500000.00');

    const response = await client.post('/api/v1/webhooks/midtrans', {
      transaction_id: 'midtrans-tx-123',
      transaction_status: 'settlement',
      fraud_status: 'accept',
      order_id: `escrow-${tx.id}`,
      gross_amount: '500000.00',
      status_code: '200',
    }, {
      'X-Callback-Signature': signature,
    });

    expect(response.status).toBe(200);
  });

  it('should reject notification with invalid signature', async () => {
    const response = await client.post('/api/v1/webhooks/midtrans', {
      transaction_id: 'midtrans-tx-123',
      transaction_status: 'settlement',
      fraud_status: 'accept',
      order_id: 'escrow-tx_test123',
      gross_amount: '500000.00',
      status_code: '200',
    }, {
      'X-Callback-Signature': 'invalid-signature',
    });

    expect(response.status).toBe(403);
  });

  it('should return 200 for expired payment notification', async () => {
    const seller = await testDb.createSeller();
    const tx = await testDb.createTransaction(seller.id, { status: 'pending' });

    const response = await client.post('/api/v1/webhooks/midtrans', {
      transaction_id: 'midtrans-tx-expired',
      transaction_status: 'expire',
      order_id: `escrow-${tx.id}`,
      gross_amount: '500000.00',
      status_code: '407',
    });

    expect(response.status).toBe(200);
  });
});
*/
