import { describe, it, expect } from 'vitest';
import { TestClient } from '../../helpers/test-client';
import { TestDatabase } from '../../helpers/test-db';

describe('E2E: Dispute Flow', () => {
  let testDb: TestDatabase;
  let client: TestClient;

  it.skip('should create a held transaction ready for dispute', async () => {
    // Requires a running server at localhost:8788
    const env = (globalThis as any).Miniflare?.env as Env | undefined;
    if (!env?.DB) {
      throw new Error('D1 binding not available');
    }
    testDb = new TestDatabase(env.DB);
    await testDb.migrate();
    client = new TestClient();

    // Transaction should be in 'held' state (funded + held)
    const txResponse = await client.get('/api/v1/transactions/tx-id');
    expect(txResponse.status).toBe(200);
    expect(txResponse.data.data.status).toBe('held');
  });

  it.skip('should open a dispute on a held transaction', async () => {
    client = new TestClient();

    const response = await client.post('/api/v1/transactions/tx-id/dispute', {
      reason: 'not_received',
      description: 'Item was not delivered within the expected timeframe',
    });

    expect(response.status).toBe(201);
    expect(response.data.data.status).toBe('open');
    expect(response.data.data.reason).toBe('not_received');
  });

  it.skip('should add evidence to the dispute', async () => {
    client = new TestClient();

    const response = await client.post('/api/v1/disputes/dispute-id/evidence', {
      dispute_id: 'dispute-id',
      file_url: 'https://example.com/evidence/photo.jpg',
      description: 'Screenshot of tracking showing no delivery',
    });

    expect(response.status).toBe(201);
  });

  it.skip('should list disputes for a transaction', async () => {
    client = new TestClient();

    const response = await client.get('/api/v1/transactions/tx-id/disputes');

    expect(response.status).toBe(200);
    expect(Array.isArray(response.data.data)).toBe(true);
    expect(response.data.data.length).toBeGreaterThan(0);
  });

  it.skip('should resolve dispute in buyer favor', async () => {
    client = new TestClient();

    const response = await client.post('/api/v1/disputes/dispute-id/resolve', {
      resolved_for: 'buyer',
      resolution: 'Refund approved - seller failed to provide proof of delivery',
    });

    expect(response.status).toBe(200);
    expect(response.data.data.resolved_for).toBe('buyer');
  });

  it.skip('should approve refund after buyer-favored resolution', async () => {
    client = new TestClient();

    const response = await client.post('/api/v1/disputes/dispute-id/refund', {});

    expect(response.status).toBe(200);
    expect(response.data.data.status).toBe('refunded');
  });

  it.skip('should reject dispute on non-held transaction', async () => {
    client = new TestClient();

    const response = await client.post('/api/v1/transactions/tx-id/dispute', {
      reason: 'not_as_described',
      description: 'Item does not match description',
    });

    expect(response.status).toBe(409);
  });

  it.skip('should reject dispute on already-disputed transaction', async () => {
    client = new TestClient();

    const response = await client.post('/api/v1/transactions/tx-id/dispute', {
      reason: 'damaged',
      description: 'Item arrived damaged',
    });

    expect(response.status).toBe(409);
  });
});
