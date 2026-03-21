import { describe, it, expect } from 'vitest';
import { TestClient } from '../../helpers/test-client';
import { TestDatabase } from '../../helpers/test-db';

describe('E2E: Buyer Confirm Flow', () => {
  let testDb: TestDatabase;
  let client: TestClient;

  it.skip('should create and fund a transaction via Midtrans', async () => {
    // Requires a running server at localhost:8788 and Midtrans sandbox
    const env = (globalThis as any).Miniflare?.env as Env | undefined;
    if (!env?.DB) {
      throw new Error('D1 binding not available');
    }
    testDb = new TestDatabase(env.DB);
    await testDb.migrate();
    client = new TestClient();

    const createResponse = await client.post('/api/v1/transactions', {
      buyer_email: 'e2e-buyer@example.com',
      buyer_phone: '+628123456789',
      amount: 500000,
    });

    expect(createResponse.status).toBe(201);
    expect(createResponse.data.data).toHaveProperty('payment_url');

    // Simulate Midtrans payment notification (settlement)
    const webhookResponse = await client.post('/api/v1/webhooks/midtrans', {
      transaction_id: 'midtrans-tx-e2e',
      transaction_status: 'settlement',
      fraud_status: 'accept',
      order_id: `escrow-${createResponse.data.data.id}`,
      gross_amount: '500000.00',
      status_code: '200',
    });

    expect(webhookResponse.status).toBe(200);

    const txResponse = await client.get(`/api/v1/transactions/${createResponse.data.data.id}`);
    expect(txResponse.status).toBe(200);
    expect(['funded', 'held']).toContain(txResponse.data.data.status);
  });

  it.skip('should mark transaction as shipped', async () => {
    client = new TestClient();

    const response = await client.post('/api/v1/transactions/tx-id/ship', {
      transaction_id: 'tx-id',
    });

    expect(response.status).toBe(200);
    expect(response.data.data.shipped_at).toBeDefined();
  });

  it.skip('should confirm receipt and release funds', async () => {
    client = new TestClient();

    const response = await client.post('/api/v1/transactions/tx-id/confirm', {
      token: 'confirmation-token',
    });

    expect(response.status).toBe(200);
    expect(response.data.data.status).toBe('released');
    expect(response.data.data.release_reason).toBe('buyer_confirmed');
  });

  it.skip('should record ledger entries after confirmation', async () => {
    client = new TestClient();

    const txResponse = await client.get('/api/v1/transactions/tx-id');
    expect(txResponse.status).toBe(200);
    expect(txResponse.data.data.status).toBe('released');
  });

  it.skip('should reject duplicate confirmation', async () => {
    client = new TestClient();

    const response = await client.post('/api/v1/transactions/tx-id/confirm', {
      token: 'confirmation-token',
    });

    expect(response.status).toBe(409);
  });
});
