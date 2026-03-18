import fs from 'fs';
import path from 'path';

export interface TestSeller {
  id: string;
  name: string;
  email: string;
  kyc_tier: string;
}

export interface SellerOverrides {
  id?: string;
  name?: string;
  email?: string;
  kyc_tier?: string;
}

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

    const statements = await this.getSchemaStatements();

    for (const statement of statements) {
      try {
        await this.db.exec(statement);
      } catch (error) {
        throw new Error(
          `Migration failed: ${error}\nStatement: ${statement.substring(0, 200)}...`
        );
      }
    }
  }

  private async getSchemaStatements(): Promise<string[]> {
    const schemaPath = path.join(process.cwd(), 'src/db/schema.sql');
    const schema = fs.readFileSync(schemaPath, 'utf-8');

    return schema
      .split(';')
      .map(s => s.trim())
      .filter(
        s => s.length > 0 && !s.startsWith('--') && !s.startsWith('/**')
      );
  }

  async reset(): Promise<void> {
    if (!this.db) {
      throw new Error('Database not initialized');
    }

    // Clear all tables in correct order (respecting foreign keys)
    // D1 doesn't support traditional transactions, but we handle errors gracefully
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
      try {
        await this.db.prepare(`DELETE FROM ${table}`).run();
      } catch (error) {
        throw new Error(`Failed to reset ${table}: ${error}`);
      }
    }
  }

  async createSeller(overrides: SellerOverrides = {}): Promise<TestSeller> {
    if (!this.db) {
      throw new Error('Database not initialized');
    }

    const id = overrides.id || crypto.randomUUID();

    await this.db
      .prepare(
        'INSERT INTO sellers (id, name, email, kyc_tier) VALUES (?, ?, ?, ?)'
      )
      .bind(
        id,
        overrides.name || 'Test',
        overrides.email || `test@${id.substring(0, 8)}.com`,
        overrides.kyc_tier || 'none'
      )
      .run();

    return {
      id,
      name: overrides.name || 'Test',
      email: overrides.email || `test@${id.substring(0, 8)}.com`,
      kyc_tier: overrides.kyc_tier || 'none',
    };
  }

  getDb(): D1Database {
    if (!this.db) {
      throw new Error('Database not initialized');
    }
    return this.db;
  }
}
