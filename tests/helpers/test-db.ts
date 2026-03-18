import { readFileSync } from 'fs';
import { join } from 'path';

export class TestDatabase {
  constructor(private db?: D1Database) {
    if (!db) {
      throw new Error('TestDatabase requires a D1 binding');
    }
  }

  async migrate(): Promise<void> {
    if (!this.db) {
      throw new Error('Database not initialized');
    }

    const schemaPath = join(process.cwd(), 'src/db/schema.sql');
    const schema = readFileSync(schemaPath, 'utf-8');

    // Split schema into individual statements
    const statements = schema
      .split(';')
      .map(s => s.trim())
      .filter(s => s.length > 0);

    // Execute each statement
    for (const statement of statements) {
      await this.db.exec(statement);
    }
  }

  async reset(): Promise<void> {
    if (!this.db) {
      throw new Error('Database not initialized');
    }

    // Clear all tables in correct order (respecting foreign keys)
    const tables = [
      'audit_log',
      'webhook_delivery_log',
      'dispute_evidence',
      'disputes',
      'ledger_entries',
      'payouts',
      'confirmation_tokens',
      'transactions',
      'seller_bank_accounts',
      'api_keys',
      'sellers',
      'admin_users',
      'schema_migrations',
    ];

    for (const table of tables) {
      await this.db.exec(`DELETE FROM ${table}`);
    }
  }

  async createSeller(overrides: Partial<any> = {}): Promise<any> {
    if (!this.db) {
      throw new Error('Database not initialized');
    }

    const seller = {
      id: overrides.id || 'test-seller-id',
      name: overrides.name || 'Test Seller',
      email: overrides.email || 'test@example.com',
      api_key_hash: overrides.api_key_hash || 'test-key-hash',
      kyc_tier: overrides.kyc_tier || 'basic',
      kyc_verified_at: overrides.kyc_verified_at || new Date().toISOString(),
      webhook_url: overrides.webhook_url || null,
      created_at: overrides.created_at || new Date().toISOString(),
      updated_at: overrides.updated_at || new Date().toISOString(),
    };

    await this.db
      .prepare(
        `
        INSERT INTO sellers (
          id, name, email, api_key_hash, kyc_tier,
          kyc_verified_at, webhook_url, created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
      `
      )
      .bind(
        seller.id,
        seller.name,
        seller.email,
        seller.api_key_hash,
        seller.kyc_tier,
        seller.kyc_verified_at,
        seller.webhook_url,
        seller.created_at,
        seller.updated_at
      )
      .run();

    return seller;
  }

  getDb(): D1Database {
    if (!this.db) {
      throw new Error('Database not initialized');
    }
    return this.db;
  }
}
