import { describe, it, expect } from 'vitest';
import { TestClient } from '../../helpers/test-client';
import { TestDatabase } from '../../helpers/test-db';

describe('E2E: Payout Flow', () => {
  let testDb: TestDatabase;
  let client: TestClient;

  it.skip('should register a bank account', async () => {
    // Requires a running server at localhost:8788
    const env = (globalThis as any).Miniflare?.env as Env | undefined;
    if (!env?.DB) {
      throw new Error('D1 binding not available');
    }
    testDb = new TestDatabase(env.DB);
    await testDb.migrate();
    client = new TestClient();

    const response = await client.post('/api/v1/bank-accounts', {
      bank_code: 'BCA',
      account_number: '1234567890',
      account_name: 'E2E Test Seller',
    });

    expect(response.status).toBe(201);
    expect(response.data.data.bank_code).toBe('BCA');
    expect(response.data.data.account_number).toBe('1234567890');
  });

  it.skip('should have available balance from a released transaction', async () => {
    client = new TestClient();

    const balanceResponse = await client.get('/api/v1/sellers/balance');
    expect(balanceResponse.status).toBe(200);
    expect(balanceResponse.data.data.available_balance).toBeGreaterThan(0);
  });

  it.skip('should create a payout request', async () => {
    client = new TestClient();

    const response = await client.post('/api/v1/payouts', {
      amount: 300000,
      bank_account_id: 'bank-account-id',
    });

    expect(response.status).toBe(201);
    expect(response.data.data.status).toBe('pending');
    expect(response.data.data.amount).toBe(300000);
  });

  it.skip('should list payouts for the seller', async () => {
    client = new TestClient();

    const response = await client.get('/api/v1/payouts');

    expect(response.status).toBe(200);
    expect(Array.isArray(response.data.data)).toBe(true);
  });

  it.skip('should reject payout exceeding available balance', async () => {
    client = new TestClient();

    const response = await client.post('/api/v1/payouts', {
      amount: 999999999,
      bank_account_id: 'bank-account-id',
    });

    expect(response.status).toBe(400);
  });

  it.skip('should process payout through bank disbursement', async () => {
    client = new TestClient();

    // This would trigger the payout scheduler or manual processing
    const response = await client.post('/api/v1/admin/payouts/payout-id/process', {});

    expect(response.status).toBe(200);
    expect(response.data.data.status).toBe('processing');
  });

  it.skip('should complete payout successfully', async () => {
    client = new TestClient();

    const response = await client.get('/api/v1/payouts/payout-id');

    expect(response.status).toBe(200);
    expect(response.data.data.status).toBe('completed');
    expect(response.data.data.disbursement_ref).toBeDefined();
  });

  it.skip('should reflect payout in seller balance', async () => {
    client = new TestClient();

    const balanceResponse = await client.get('/api/v1/sellers/balance');
    expect(balanceResponse.status).toBe(200);
    expect(balanceResponse.data.data.pending_payouts).toBeGreaterThanOrEqual(0);
  });

  it.skip('should reject payout without bank account', async () => {
    client = new TestClient();

    const response = await client.post('/api/v1/payouts', {
      amount: 100000,
      bank_account_id: 'nonexistent-id',
    });

    expect(response.status).toBe(404);
  });
});
