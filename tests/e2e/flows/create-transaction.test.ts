import { describe, it, expect } from 'vitest';
import { TestClient } from '../../helpers/test-client';
import { TestDatabase } from '../../helpers/test-db';

describe('E2E: Create Transaction Flow', () => {
  let testDb: TestDatabase;
  let client: TestClient;

  it.skip('should register a seller account', async () => {
    // Requires a running server at localhost:8788
    const env = (globalThis as any).Miniflare?.env as Env | undefined;
    if (!env?.DB) {
      throw new Error('D1 binding not available');
    }
    testDb = new TestDatabase(env.DB);
    await testDb.migrate();
    client = new TestClient();

    const response = await client.post('/api/v1/auth/register', {
      name: 'E2E Test Seller',
      email: 'e2e-seller@example.com',
      password: 'Password123',
    });

    expect(response.status).toBe(201);
    expect(response.data.data).toHaveProperty('id');
  });

  it.skip('should login and obtain access token', async () => {
    client = new TestClient();

    const response = await client.post('/api/v1/auth/login', {
      email: 'e2e-seller@example.com',
      password: 'Password123',
    });

    expect(response.status).toBe(200);
    expect(response.data.data).toHaveProperty('token');
  });

  it.skip('should create a new escrow transaction', async () => {
    client = new TestClient();

    const response = await client.post('/api/v1/transactions', {
      buyer_email: 'e2e-buyer@example.com',
      buyer_phone: '+628123456789',
      amount: 500000,
    });

    expect(response.status).toBe(201);
    expect(response.data.data.status).toBe('pending');
    expect(response.data.data.amount).toBe(500000);
    expect(response.data.data.fee_amount).toBeGreaterThan(0);
    expect(response.data.data.net_amount).toBe(495000);
    expect(response.data.data).toHaveProperty('id');
  });

  it.skip('should retrieve the created transaction', async () => {
    client = new TestClient();

    const response = await client.get('/api/v1/transactions/tx-id');

    expect(response.status).toBe(200);
    expect(response.data.data.id).toBeDefined();
    expect(response.data.data.buyer_email).toBe('e2e-buyer@example.com');
  });

  it.skip('should list all seller transactions', async () => {
    client = new TestClient();

    const response = await client.get('/api/v1/transactions');

    expect(response.status).toBe(200);
    expect(Array.isArray(response.data.data)).toBe(true);
  });
});
