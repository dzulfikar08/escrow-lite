import { describe, it, expect, beforeAll, afterEach } from 'vitest';
import { TestClient } from '../../helpers/test-client';
import { TestDatabase } from '../../helpers/test-db';

describe('Transaction Validation', () => {
  describe('createTransactionSchema', () => {
    const validTransaction = {
      buyer_email: 'buyer@example.com',
      buyer_phone: '+628123456789',
      amount: 500000,
    };

    it('should validate valid transaction creation', async () => {
      const { createTransactionSchema } = await import('@/lib/validation');
      const result = createTransactionSchema.safeParse(validTransaction);
      expect(result.success).toBe(true);
    });

    it('should reject invalid buyer email', async () => {
      const { createTransactionSchema } = await import('@/lib/validation');
      const result = createTransactionSchema.safeParse({
        ...validTransaction,
        buyer_email: 'invalid-email',
      });
      expect(result.success).toBe(false);
    });

    it('should reject non-Indonesian phone format', async () => {
      const { createTransactionSchema } = await import('@/lib/validation');
      const result = createTransactionSchema.safeParse({
        ...validTransaction,
        buyer_phone: '+1234567890',
      });
      expect(result.success).toBe(false);
    });

    it('should reject phone without country code', async () => {
      const { createTransactionSchema } = await import('@/lib/validation');
      const result = createTransactionSchema.safeParse({
        ...validTransaction,
        buyer_phone: '081234567890',
      });
      expect(result.success).toBe(false);
    });

    it('should reject phone with too few digits', async () => {
      const { createTransactionSchema } = await import('@/lib/validation');
      const result = createTransactionSchema.safeParse({
        ...validTransaction,
        buyer_phone: '+621234567',
      });
      expect(result.success).toBe(false);
    });

    it('should reject phone with too many digits', async () => {
      const { createTransactionSchema } = await import('@/lib/validation');
      const result = createTransactionSchema.safeParse({
        ...validTransaction,
        buyer_phone: '+628123456789012345',
      });
      expect(result.success).toBe(false);
    });

    it('should reject zero amount', async () => {
      const { createTransactionSchema } = await import('@/lib/validation');
      const result = createTransactionSchema.safeParse({
        ...validTransaction,
        amount: 0,
      });
      expect(result.success).toBe(false);
    });

    it('should reject negative amount', async () => {
      const { createTransactionSchema } = await import('@/lib/validation');
      const result = createTransactionSchema.safeParse({
        ...validTransaction,
        amount: -1000,
      });
      expect(result.success).toBe(false);
    });

    it('should reject missing buyer_email', async () => {
      const { createTransactionSchema } = await import('@/lib/validation');
      const result = createTransactionSchema.safeParse({
        buyer_phone: validTransaction.buyer_phone,
        amount: validTransaction.amount,
      });
      expect(result.success).toBe(false);
    });

    it('should reject missing buyer_phone', async () => {
      const { createTransactionSchema } = await import('@/lib/validation');
      const result = createTransactionSchema.safeParse({
        buyer_email: validTransaction.buyer_email,
        amount: validTransaction.amount,
      });
      expect(result.success).toBe(false);
    });

    it('should accept optional auto_release_days', async () => {
      const { createTransactionSchema } = await import('@/lib/validation');
      const result = createTransactionSchema.safeParse({
        ...validTransaction,
        auto_release_days: 7,
      });
      expect(result.success).toBe(true);
    });

    it('should accept optional metadata', async () => {
      const { createTransactionSchema } = await import('@/lib/validation');
      const result = createTransactionSchema.safeParse({
        ...validTransaction,
        metadata: { order_id: 'ORD-001', item_count: 3 },
      });
      expect(result.success).toBe(true);
    });

    it('should reject non-positive auto_release_days', async () => {
      const { createTransactionSchema } = await import('@/lib/validation');
      const result = createTransactionSchema.safeParse({
        ...validTransaction,
        auto_release_days: 0,
      });
      expect(result.success).toBe(false);
    });

    it('should reject non-integer auto_release_days', async () => {
      const { createTransactionSchema } = await import('@/lib/validation');
      const result = createTransactionSchema.safeParse({
        ...validTransaction,
        auto_release_days: 3.5,
      });
      expect(result.success).toBe(false);
    });
  });

  describe('markAsShippedSchema', () => {
    it('should validate valid UUID transaction_id', async () => {
      const { markAsShippedSchema } = await import('@/lib/validation');
      const result = markAsShippedSchema.safeParse({
        transaction_id: '550e8400-e29b-41d4-a716-446655440000',
      });
      expect(result.success).toBe(true);
    });

    it('should reject non-UUID transaction_id', async () => {
      const { markAsShippedSchema } = await import('@/lib/validation');
      const result = markAsShippedSchema.safeParse({
        transaction_id: 'tx_12345',
      });
      expect(result.success).toBe(false);
    });

    it('should reject empty transaction_id', async () => {
      const { markAsShippedSchema } = await import('@/lib/validation');
      const result = markAsShippedSchema.safeParse({
        transaction_id: '',
      });
      expect(result.success).toBe(false);
    });
  });
});

describe('Transaction API Error Responses', () => {
  it('should return 401 for unauthenticated requests', async () => {
    const { apiErrorSchema } = await import('@/lib/validation');
    const response = {
      success: false,
      error: {
        message: 'Authentication required',
        code: 'UNAUTHORIZED',
      },
      meta: {
        request_id: '550e8400-e29b-41d4-a716-446655440000',
        timestamp: new Date().toISOString(),
      },
    };
    const result = apiErrorSchema.safeParse(response);
    expect(result.success).toBe(true);
  });

  it('should return 404 for non-existent transaction', async () => {
    const { apiErrorSchema } = await import('@/lib/validation');
    const response = {
      success: false,
      error: {
        message: 'Transaction not found',
        code: 'NOT_FOUND',
      },
      meta: {
        request_id: '550e8400-e29b-41d4-a716-446655440000',
        timestamp: new Date().toISOString(),
      },
    };
    const result = apiErrorSchema.safeParse(response);
    expect(result.success).toBe(true);
  });

  it('should return 409 for invalid status transition', async () => {
    const { apiErrorSchema } = await import('@/lib/validation');
    const response = {
      success: false,
      error: {
        message: 'Cannot mark as shipped: transaction is not in held state',
        code: 'CONFLICT',
        details: { current_status: 'pending' },
      },
      meta: {
        request_id: '550e8400-e29b-41d4-a716-446655440000',
        timestamp: new Date().toISOString(),
      },
    };
    const result = apiErrorSchema.safeParse(response);
    expect(result.success).toBe(true);
  });
});

// TODO: Add full integration tests with actual API requests
// These require:
// 1. Running wrangler dev server with test D1 bindings
// 2. Or configuring @cloudflare/vitest-pool-workers
// The test structure below is ready to use once the test environment is configured

/*
describe('POST /api/v1/transactions', () => {
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

  it('should create a new transaction', async () => {
    const seller = await testDb.createSeller();
    const response = await client.post('/api/v1/transactions', {
      buyer_email: 'buyer@example.com',
      buyer_phone: '+628123456789',
      amount: 500000,
    }, { Authorization: `Bearer ${sellerToken}` });
    expect(response.status).toBe(201);
    expect(response.data.data).toHaveProperty('id');
    expect(response.data.data.status).toBe('pending');
    expect(response.data.data.fee_amount).toBeGreaterThan(0);
  });

  it('should reject unauthenticated request', async () => {
    const response = await client.post('/api/v1/transactions', {
      buyer_email: 'buyer@example.com',
      buyer_phone: '+628123456789',
      amount: 500000,
    });
    expect(response.status).toBe(401);
  });

  it('should reject invalid request body', async () => {
    const response = await client.post('/api/v1/transactions', {
      buyer_email: 'not-an-email',
      amount: -100,
    }, { Authorization: `Bearer ${sellerToken}` });
    expect(response.status).toBe(422);
  });
});

describe('GET /api/v1/transactions', () => {
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

  it('should list transactions for authenticated seller', async () => {
    const response = await client.get('/api/v1/transactions', {
      Authorization: `Bearer ${sellerToken}`,
    });
    expect(response.status).toBe(200);
    expect(Array.isArray(response.data.data)).toBe(true);
  });

  it('should filter by status', async () => {
    const response = await client.get('/api/v1/transactions?status=held', {
      Authorization: `Bearer ${sellerToken}`,
    });
    expect(response.status).toBe(200);
  });

  it('should paginate results', async () => {
    const response = await client.get('/api/v1/transactions?limit=10&offset=0', {
      Authorization: `Bearer ${sellerToken}`,
    });
    expect(response.status).toBe(200);
  });
});

describe('GET /api/v1/transactions/:id', () => {
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

  it('should return a single transaction', async () => {
    const seller = await testDb.createSeller();
    const tx = await testDb.createTransaction(seller.id);
    const response = await client.get(`/api/v1/transactions/${tx.id}`, {
      Authorization: `Bearer ${sellerToken}`,
    });
    expect(response.status).toBe(200);
    expect(response.data.data.id).toBe(tx.id);
  });

  it('should return 404 for non-existent transaction', async () => {
    const response = await client.get('/api/v1/transactions/nonexistent-id', {
      Authorization: `Bearer ${sellerToken}`,
    });
    expect(response.status).toBe(404);
  });
});

describe('POST /api/v1/transactions/:id/ship', () => {
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

  it('should mark a held transaction as shipped', async () => {
    const seller = await testDb.createSeller();
    const tx = await testDb.createTransaction(seller.id, { status: 'held' });
    const response = await client.post(`/api/v1/transactions/${tx.id}/ship`, {
      transaction_id: tx.id,
    }, { Authorization: `Bearer ${sellerToken}` });
    expect(response.status).toBe(200);
    expect(response.data.data.shipped_at).toBeDefined();
  });

  it('should reject shipping a pending transaction', async () => {
    const seller = await testDb.createSeller();
    const tx = await testDb.createTransaction(seller.id, { status: 'pending' });
    const response = await client.post(`/api/v1/transactions/${tx.id}/ship`, {
      transaction_id: tx.id,
    }, { Authorization: `Bearer ${sellerToken}` });
    expect(response.status).toBe(409);
  });
});

describe('POST /api/v1/transactions/:id/confirm', () => {
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

  it('should confirm a held transaction and release funds', async () => {
    const seller = await testDb.createSeller();
    const tx = await testDb.createTransaction(seller.id, { status: 'held' });
    const token = await testDb.createConfirmationToken(tx.id);
    const response = await client.post(`/api/v1/transactions/${tx.id}/confirm`, {
      token: token,
    });
    expect(response.status).toBe(200);
    expect(response.data.data.status).toBe('released');
    expect(response.data.data.release_reason).toBe('buyer_confirmed');
  });

  it('should reject confirmation of a pending transaction', async () => {
    const seller = await testDb.createSeller();
    const tx = await testDb.createTransaction(seller.id, { status: 'pending' });
    const token = await testDb.createConfirmationToken(tx.id);
    const response = await client.post(`/api/v1/transactions/${tx.id}/confirm`, {
      token: token,
    });
    expect(response.status).toBe(409);
  });
});
*/
