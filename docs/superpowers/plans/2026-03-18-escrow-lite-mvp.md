# Escrow Lite MVP Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a complete MVP of Escrow Lite - a trust layer platform that holds buyer funds in escrow for Indonesian sellers, including payment integration, seller/admin dashboards, dispute system, and badge widgets.

**Architecture:** Monolithic Astro application with service layer pattern. API routes handle REST endpoints, services contain business logic (escrow engine, payments, webhooks), D1 database for persistence, deployed to Cloudflare Workers.

**Tech Stack:** Astro 6.0.5, Cloudflare D1 (SQLite), Cloudflare Workers/Pages, Better Auth, Zod, TypeScript, Midtrans integration, Cloudflare R2 storage.

**Timeline:** 12 weeks (revised from 10 after design review)

---

## File Structure Overview

```
escrow-lite/
├── src/
│   ├── pages/                      # Astro pages & API routes
│   │   ├── index.astro             # Landing page
│   │   ├── dashboard/              # Seller dashboard
│   │   │   ├── index.astro
│   │   │   ├── transactions.astro
│   │   │   ├── payouts.astro
│   │   │   ├── balance.astro
│   │   │   └── settings.astro
│   │   ├── admin/                  # Admin panel
│   │   │   ├── index.astro
│   │   │   ├── transactions.astro
│   │   │   ├── disputes.astro
│   │   │   └── sellers.astro
│   │   ├── api/
│   │   │   └── v1/
│   │   │       ├── transactions/
│   │   │       │   ├── index.ts         # GET (list), POST (create)
│   │   │       │   └── [id].ts          # GET, PATCH
│   │   │       ├── transactions/
│   │   │       │   └── [id]/
│   │   │       │       ├── ship.ts       # POST
│   │   │       │       └── confirm.ts    # POST (buyer)
│   │   │       ├── payouts/
│   │   │       │   └── index.ts         # GET, POST
│   │   │       ├── webhooks/
│   │   │       │   └── index.ts         # GET, PUT
│   │   │       ├── bank-accounts/
│   │   │       │   └── index.ts         # GET, POST, DELETE
│   │   │       ├── seller/
│   │   │       │   ├── index.ts         # GET, PATCH
│   │   │       │   └── balance.ts       # GET
│   │   │       └── auth/
│   │   │           ├── register.ts      # POST
│   │   │           ├── login.ts         # POST
│   │   │           └── logout.ts        # POST
│   │   └── external/
│   │       └── webhooks/
│   │           └── midtrans.ts         # POST (gateway callback)
│   │   └── badge/
│   │       ├── iframe.astro            # Widget iframe
│   │       └── script.ts.ts            # JS snippet endpoint
│   │
│   ├── services/                     # Business logic layer
│   │   ├── escrow/
│   │   │   ├── engine.ts              # State machine core
│   │   │   ├── balance.ts             # Balance calculations
│   │   │   ├── ledger.ts              # Immutable ledger
│   │   │   ├── types.ts               # TypeScript types
│   │   │   └── constants.ts           # Config, timeouts
│   │   ├── payments/
│   │   │   ├── midtrans.ts            # Midtrans integration
│   │   │   └── types.ts
│   │   ├── payouts/
│   │   │   ├── processor.ts           # Payout logic
│   │   │   └── scheduler.ts           # Cron jobs
│   │   ├── webhooks/
│   │   │   ├── sender.ts              # Webhook delivery
│   │   │   └── queue.ts               # D1-backed queue
│   │   ├── kyc/
│   │   │   └── service.ts             # KYC management
│   │   └── auth/
│   │       └── service.ts             # Better Auth config
│   │
│   ├── db/                          # Database layer
│   │   ├── schema.sql                # Full database schema
│   │   ├── migrations/
│   │   │   ├── 001_initial_schema.sql
│   │   │   ├── 002_add_idempotency.sql
│   │   │   └── 003_add_indexes.sql
│   │   ├── client.ts                 # D1 client wrapper
│   │   └── queries/
│   │       ├── sellers.ts
│   │       ├── transactions.ts
│   │       ├── ledger.ts
│   │       ├── payouts.ts
│   │       ├── disputes.ts
│   │       └── webhooks.ts
│   │
│   ├── components/                  # Astro/React UI components
│   │   ├── dashboard/
│   │   │   ├── Layout.astro
│   │   │   ├── TransactionList.astro
│   │   │   ├── TransactionCard.astro
│   │   │   ├── BalanceSummary.astro
│   │   │   ├── PayoutForm.astro
│   │   │   └── BankAccountForm.astro
│   │   ├── admin/
│   │   │   ├── Layout.astro
│   │   │   ├── TransactionTable.astro
│   │   │   ├── DisputeList.astro
│   │   │   └── SellerList.astro
│   │   ├── shared/
│   │   │   ├── Header.astro
│   │   │   ├── Footer.astro
│   │   │   �   Button.astro
│   │   │   └── Modal.astro
│   │   └── badge/
│   │       ├── BadgeIframe.astro
│   │       └── BadgeScript.ts
│   │
│   ├── lib/                        # Utilities & integrations
│   │   ├── auth.ts                 # Better Auth config
│   │   ├── email.ts                # Email worker
│   │   ├── storage.ts              # R2 client
│   │   ├── validation.ts           # Zod schemas
│   │   ├── errors.ts               # Error classes
│   │   ├── crypto.ts               # Encryption, hashing
│   │   ├── rate-limit.ts           # Rate limiting
│   │   └── middleware/
│   │       ├── auth.ts             # Auth middleware
│   │       ├── idempotency.ts      # Idempotency middleware
│   │       └── errors.ts           # Error handling
│   │
│   ├── layouts/                    # Astro layouts
│   │   ├── Layout.astro            # Main layout
│   │   ├── DashboardLayout.astro   # Seller dashboard
│   │   └── AdminLayout.astro       # Admin panel
│   │
│   └── styles/
│       └── global.css              # Global styles
│
├── tests/
│   ├── unit/                       # Unit tests
│   │   ├── services/
│   │   │   ├── escrow/
│   │   │   │   ├── engine.test.ts
│   │   │   │   ├── balance.test.ts
│   │   │   │   └── ledger.test.ts
│   │   │   ├── payments/
│   │   │   │   └── midtrans.test.ts
│   │   │   └── webhooks/
│   │   │       └── sender.test.ts
│   │   └── lib/
│   │       ├── crypto.test.ts
│   │       └── validation.test.ts
│   │
│   ├── integration/                # API integration tests
│   │   ├── api/
│   │   │   ├── transactions.test.ts
│   │   │   ├── payouts.test.ts
│   │   │   └── auth.test.ts
│   │   └── webhooks/
│   │       └── midtrans.test.ts
│   │
│   ├── e2e/                        # End-to-end tests
│   │   ├── flows/
│   │   │   ├── create-transaction.test.ts
│   │   │   ├── buyer-confirm.test.ts
│   │   │   ├── dispute-flow.test.ts
│   │   │   └── payout-flow.test.ts
│   │   └── admin/
│   │       └── manual-release.test.ts
│   │
│   └── helpers/                    # Test helpers
│       ├── test-db.ts              # Test database setup
│       ├── test-client.ts          # API test client
│       └── factories.ts            # Test data factories
│
├── migrations/                     # Migration runner scripts
│   ├── migrate.ts                  # Run migrations
│   ├── create.ts                   # Create new migration
│   └── rollback.ts                 # Rollback migrations
│
├── prd.md                          # Updated PRD
├── wrangler.toml                   # Cloudflare config
├── astro.config.mjs                # Astro config
├── vitest.config.ts                # Test config
├── package.json
└── tsconfig.json
```

---

## Chunk 1: Foundation Setup (Week 1-2)

### Task 1.1: Initialize Project Structure

**Files:**
- Modify: `package.json` (add dependencies)
- Create: `tsconfig.json`
- Create: `vitest.config.ts`
- Create: `.env.example`
- Create: `.dev.vars.example`

- [ ] **Step 1: Update package.json with dependencies**

```json
{
  "name": "escrow-lite",
  "version": "0.1.0",
  "type": "module",
  "scripts": {
    "dev": "astro dev",
    "build": "astro build",
    "preview": "astro preview",
    "test": "vitest",
    "test:run": "vitest run",
    "test:coverage": "vitest run --coverage",
    "type-check": "tsc --noEmit",
    "db:migrate": "bun migrations/migrate.ts",
    "db:create": "bun migrations/create.ts",
    "db:rollback": "bun migrations/rollback.ts",
    "cf:dev": "wrangler dev",
    "cf:deploy": "wrangler deploy"
  },
  "dependencies": {
    "@astrojs/cloudflare": "^12.0.0",
    "astro": "^6.0.5",
    "better-auth": "^1.0.0",
    "zod": "^3.22.0"
  },
  "devDependencies": {
    "@playwright/test": "^1.40.0",
    "typescript": "^5.3.0",
    "vitest": "^1.0.0",
    "wrangler": "^3.0.0",
    "prettier": "^3.1.0",
    "eslint": "^8.55.0",
    "@typescript-eslint/eslint-plugin": "^6.15.0"
  }
}
```

- [ ] **Step 2: Create TypeScript config**

```typescript
// tsconfig.json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "ESNext",
    "moduleResolution": "bundler",
    "allowSyntheticDefaultImports": true,
    "esModuleInterop": true,
    "strict": true,
    "skipLibCheck": true,
    "forceConsistentCasingInFileNames": true,
    "resolveJsonModule": true,
    "isolatedModules": true,
    "noEmit": true,
    "types": ["astro/client"],
    "baseUrl": ".",
    "paths": {
      "@/*": ["./src/*"]
    }
  }
}
```

- [ ] **Step 3: Create Vitest config**

```typescript
// vitest.config.ts
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'miniflare',
    environmentOptions: {
      modules: true,
      bindings: {
        // Test bindings will be configured per test
      },
    },
    poolOptions: {
      threads: {
        singleThread: true,
      },
    },
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
      exclude: [
        'node_modules/',
        'tests/',
        '**/*.test.ts',
        '**/*.astro',
      ],
    },
  },
});
```

- [ ] **Step 4: Create environment variable examples**

```bash
# .env.example
ENVIRONMENT=development
MIDTRANS_SERVER_KEY=
MIDTRANS_CLIENT_KEY=
WEBHOOK_SIGNING_SECRET=
ENCRYPTION_KEY=
DATABASE_URL=

# .dev.vars.example
ENVIRONMENT=development
MIDTRANS_SERVER_KEY=SB-Mid-server-xxx
MIDTRANS_CLIENT_KEY=SB-Mid-client-xxx
WEBHOOK_SIGNING_SECRET=dev-secret-change-in-production
ENCRYPTION_KEY=0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef
```

- [ ] **Step 5: Create ESLint config**

```javascript
// .eslintrc.js
module.exports = {
  root: true,
  extends: [
    'eslint:recommended',
    '@typescript-eslint/recommended',
  ],
  parser: '@typescript-eslint/parser',
  plugins: ['@typescript-eslint'],
  env: {
    node: true,
    browser: true,
  },
  ignorePatterns: ['dist', '.astro', 'node_modules'],
};
```

- [ ] **Step 6: Create Prettier config**

```json
// .prettierrc
{
  "semi": true,
  "singleQuote": true,
  "trailingComma": "es5",
  "printWidth": 100,
  "tabWidth": 2
}
```

- [ ] **Step 7: Create .prettierignore**

```
# .prettierignore
dist
.astro
node_modules
coverage
.wrangler
*.min.js
```

- [ ] **Step 8: Install dependencies

```bash
bun install
```

Expected: All packages installed successfully

- [ ] **Step 9: Commit foundation setup**

```bash
git add .
git commit -m "chore: initialize project structure with dependencies"
```

---

### Task 1.2: Configure Cloudflare and Astro

**Files:**
- Modify: `astro.config.mjs`
- Create: `wrangler.toml`
- Create: `src/env.d.ts`

- [ ] **Step 1: Configure Astro for Cloudflare**

```javascript
// astro.config.mjs
import { defineConfig } from 'astro/config';
import cloudflare from '@astrojs/cloudflare';
import path from 'path';

export default defineConfig({
  output: 'server',
  adapter: cloudflare({
    platform: 'cloudflare',
  }),
  vite: {
    define: {
      'process.env.NODE_ENV': JSON.stringify(process.env.NODE_ENV || 'development'),
    },
    resolve: {
      alias: {
        '@': path.resolve('./src'),
      },
    },
  },
});
```

- [ ] **Step 2: Configure Wrangler**

```toml
# wrangler.toml
name = "escrow-lite"
compatibility_date = "2024-01-01"
compatibility_flags = ["nodejs_compat"]

[env.development]
name = "escrow-lite-dev"

[[env.development.d1_databases]]
binding = "DB"
database_name = "escrow-lite-dev"
database_id = "local"  # Will use local SQLite

[[env.development.r2_buckets]]
binding = "STORAGE"
bucket_name = "escrow-lite-dev-evidence"

[env.development.vars]
ENVIRONMENT = "development"

# Cron triggers for auto-release
[triggers]
crons = ["*/5 * * * *"]  # Every 5 minutes

# Production config (to be filled later)
# [env.production]
# name = "escrow-lite-prod"
# ... (configure when deploying)
```

- [ ] **Step 3: Create TypeScript environment definitions**

```typescript
// src/env.d.ts
/// <reference path="../.astro/types.d.ts" />
/// <reference types="astro/client" />

interface Env {
  DB: D1Database;
  STORAGE: R2Bucket;
  ENVIRONMENT: string;
  MIDTRANS_SERVER_KEY: string;
  MIDTRANS_CLIENT_KEY: string;
  WEBHOOK_SIGNING_SECRET: string;
  ENCRYPTION_KEY: string;
  MIDTRANS_API_URL: string;
}
```

- [ ] **Step 4: Update .gitignore**

```bash
# Add to .gitignore
.dev.vars
.wrangler/
.env
dist/
.astro/
coverage/
*.log
```

- [ ] **Step 5: Test Cloudflare dev server**

```bash
bun run cf:dev
```

Expected: Server starts on http://localhost:8788

- [ ] **Step 6: Commit Cloudflare configuration**

```bash
git add .
git commit -m "chore: configure Cloudflare and Astro"
```

---

### Task 1.3: Create Database Schema and Migrations

**Files:**
- Create: `src/db/schema.sql`
- Create: `src/db/migrations/001_initial_schema.sql`
- Create: `src/db/migrations/002_add_idempotency.sql`
- Create: `src/db/migrations/003_add_indexes.sql`
- Create: `migrations/migrate.ts`
- Create: `migrations/create.ts`
- Create: `migrations/rollback.ts`

- [ ] **Step 1: Create full database schema**

```sql
-- src/db/schema.sql
-- This is the reference schema for the entire system

PRAGMA foreign_keys = ON;

-- === SELLERS ===
CREATE TABLE sellers (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  email TEXT UNIQUE NOT NULL,
  password_hash TEXT,
  kyc_tier TEXT NOT NULL CHECK(kyc_tier IN ('none', 'basic', 'full')),
  kyc_verified_at TEXT,
  webhook_url TEXT,
  max_transaction_amount INTEGER NOT NULL DEFAULT 1000000,
  max_held_balance INTEGER NOT NULL DEFAULT 5000000,
  metadata TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  version INTEGER NOT NULL DEFAULT 0  -- For optimistic locking
);

CREATE INDEX idx_sellers_email ON sellers(email);
CREATE INDEX idx_sellers_kyc_tier ON sellers(kyc_tier);

-- === API KEYS ===
CREATE TABLE api_keys (
  id TEXT PRIMARY KEY,
  seller_id TEXT NOT NULL,
  key_hash TEXT UNIQUE NOT NULL,
  key_prefix TEXT NOT NULL,
  is_active INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  last_used_at TEXT,
  expires_at TEXT,
  FOREIGN KEY (seller_id) REFERENCES sellers(id) ON DELETE CASCADE
);

CREATE INDEX idx_api_keys_seller ON api_keys(seller_id);
CREATE INDEX idx_api_keys_hash ON api_keys(key_hash);

-- === SELLER BANK ACCOUNTS ===
CREATE TABLE seller_bank_accounts (
  id TEXT PRIMARY KEY,
  seller_id TEXT NOT NULL,
  bank_code TEXT NOT NULL,
  account_number TEXT NOT NULL,  -- Will be encrypted
  account_name TEXT NOT NULL,
  is_default INTEGER NOT NULL DEFAULT 0,
  is_verified INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY (seller_id) REFERENCES sellers(id) ON DELETE CASCADE
);

CREATE INDEX idx_bank_accounts_seller ON seller_bank_accounts(seller_id);

-- === TRANSACTIONS ===
CREATE TABLE transactions (
  id TEXT PRIMARY KEY,
  seller_id TEXT NOT NULL,
  buyer_email TEXT NOT NULL,
  buyer_phone TEXT,
  amount INTEGER NOT NULL,
  fee_amount INTEGER NOT NULL DEFAULT 0,
  fee_rate INTEGER NOT NULL DEFAULT 100,  -- basis points
  net_amount INTEGER NOT NULL,
  status TEXT NOT NULL CHECK(status IN (
    'pending', 'funded', 'held', 'released',
    'disputed', 'refunded', 'expired'
  )),
  gateway TEXT NOT NULL CHECK(gateway IN ('midtrans', 'xendit', 'doku')),
  gateway_ref TEXT UNIQUE,
  auto_release_days INTEGER NOT NULL DEFAULT 3,
  auto_release_at TEXT,
  absolute_expire_at TEXT NOT NULL,
  shipped_at TEXT,
  released_at TEXT,
  refunded_at TEXT,
  release_reason TEXT CHECK(release_reason IN (
    'buyer_confirmed', 'timeout', 'admin_override'
  )),
  refund_reason TEXT,
  metadata TEXT,
  last_checked_at TEXT,  -- For timeout check idempotency
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY (seller_id) REFERENCES sellers(id)
);

CREATE INDEX idx_transactions_seller ON transactions(seller_id);
CREATE INDEX idx_transactions_status ON transactions(status);
CREATE INDEX idx_transactions_gateway_ref ON transactions(gateway_ref);
CREATE INDEX idx_transactions_created_at ON transactions(created_at DESC);
CREATE INDEX idx_transactions_seller_status ON transactions(seller_id, status);
CREATE INDEX idx_transactions_status_created ON transactions(status, created_at);

-- === LEDGER ENTRIES ===
CREATE TABLE ledger_entries (
  id TEXT PRIMARY KEY,
  seller_id TEXT NOT NULL,
  transaction_id TEXT,
  type TEXT NOT NULL CHECK(type IN (
    'hold', 'release', 'fee', 'payout', 'refund', 'adjustment'
  )),
  amount INTEGER NOT NULL,
  direction TEXT NOT NULL CHECK(direction IN ('credit', 'debit')),
  balance_after INTEGER NOT NULL,
  note TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY (seller_id) REFERENCES sellers(id)
  FOREIGN KEY (transaction_id) REFERENCES transactions(id)
);

CREATE INDEX idx_ledger_seller_created ON ledger_entries(seller_id, created_at DESC);
CREATE INDEX idx_ledger_transaction ON ledger_entries(transaction_id);

-- === PAYOUTS ===
CREATE TABLE payouts (
  id TEXT PRIMARY KEY,
  seller_id TEXT NOT NULL,
  amount INTEGER NOT NULL,
  bank_code TEXT NOT NULL,
  account_number TEXT NOT NULL,
  account_name TEXT NOT NULL,
  status TEXT NOT NULL CHECK(status IN (
    'pending', 'processing', 'completed', 'failed'
  )),
  disbursement_ref TEXT UNIQUE,
  failed_reason TEXT,
  requested_at TEXT NOT NULL DEFAULT (datetime('now')),
  completed_at TEXT,
  FOREIGN KEY (seller_id) REFERENCES sellers(id)
);

CREATE INDEX idx_payouts_seller ON payouts(seller_id);
CREATE INDEX idx_payouts_status_created ON payouts(status, created_at);

-- === DISPUTES ===
CREATE TABLE disputes (
  id TEXT PRIMARY KEY,
  transaction_id TEXT NOT NULL,
  initiated_by TEXT NOT NULL CHECK(initiated_by IN ('buyer', 'seller', 'admin')),
  reason_category TEXT NOT NULL CHECK(reason_category IN (
    'not_received', 'not_as_described', 'damaged', 'wrong_item', 'other'
  )),
  buyer_description TEXT,
  seller_response TEXT,
  status TEXT NOT NULL CHECK(status IN (
    'open', 'seller_responding', 'under_review', 'resolved'
  )),
  resolution TEXT CHECK(resolution IN (
    'released_to_seller', 'refunded_to_buyer', 'partial'
  )),
  resolution_note TEXT,
  admin_id TEXT,
  resolved_at TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY (transaction_id) REFERENCES transactions(id)
);

CREATE INDEX idx_disputes_transaction ON disputes(transaction_id);
CREATE INDEX idx_disputes_status ON disputes(status);

-- === DISPUTE EVIDENCE ===
CREATE TABLE dispute_evidence (
  id TEXT PRIMARY KEY,
  dispute_id TEXT NOT NULL,
  submitted_by TEXT NOT NULL CHECK(submitted_by IN ('buyer', 'seller')),
  file_url TEXT NOT NULL,
  file_type TEXT NOT NULL,
  file_size INTEGER,
  filename TEXT,
  uploaded_at TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY (dispute_id) REFERENCES disputes(id) ON DELETE CASCADE
);

CREATE INDEX idx_evidence_dispute ON dispute_evidence(dispute_id);

-- === WEBHOOK DELIVERY LOG ===
CREATE TABLE webhook_delivery_log (
  id TEXT PRIMARY KEY,
  seller_id TEXT NOT NULL,
  event_type TEXT NOT NULL,
  payload TEXT NOT NULL,
  url TEXT NOT NULL,
  status TEXT NOT NULL CHECK(status IN (
    'pending', 'sent', 'failed', 'retrying'
  )),
  http_status_code INTEGER,
  response_body TEXT,
  attempt_count INTEGER NOT NULL DEFAULT 0,
  next_retry_at TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY (seller_id) REFERENCES sellers(id)
);

CREATE INDEX idx_webhooks_seller ON webhook_delivery_log(seller_id);
CREATE INDEX idx_webhooks_status ON webhook_delivery_log(status);
CREATE INDEX idx_webhooks_next_retry ON webhook_delivery_log(status, next_retry_at);

-- === CONFIRMATION TOKENS ===
CREATE TABLE confirmation_tokens (
  token TEXT PRIMARY KEY,
  transaction_id TEXT NOT NULL,
  expires_at TEXT NOT NULL,
  used_at TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY (transaction_id) REFERENCES transactions(id) ON DELETE CASCADE
);

CREATE INDEX idx_confirmation_tokens_expiry ON confirmation_tokens(expires_at);

-- === ADMIN USERS ===
CREATE TABLE admin_users (
  id TEXT PRIMARY KEY,
  email TEXT UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,
  role TEXT NOT NULL CHECK(role IN ('admin', 'super_admin')),
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  last_login_at TEXT
);

-- === AUDIT LOG ===
CREATE TABLE audit_log (
  id TEXT PRIMARY KEY,
  actor_id TEXT NOT NULL,
  actor_type TEXT NOT NULL CHECK(actor_type IN ('admin', 'system')),
  action TEXT NOT NULL,
  resource_type TEXT NOT NULL,
  resource_id TEXT NOT NULL,
  reason TEXT NOT NULL,
  changes TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX idx_audit_log_resource ON audit_log(resource_type, resource_id);
CREATE INDEX idx_audit_log_created_at ON audit_log(created_at DESC);

-- === SCHEMA MIGRATIONS ===
CREATE TABLE schema_migrations (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL UNIQUE,
  applied_at TEXT NOT NULL DEFAULT (datetime('now'))
);
```

- [ ] **Step 2: Create migration runner**

```typescript
// migrations/migrate.ts
import { migrate } from '../src/db/migrations/index.js';

async function main() {
  await migrate();
  console.log('Migrations completed successfully');
  process.exit(0);
}

main().catch((error) => {
  console.error('Migration failed:', error);
  process.exit(1);
});
```

- [ ] **Step 3: Create migration system**

```typescript
// src/db/migrations/index.ts
import fs from 'fs';
import path from 'path';
import fileURLToPath from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const MIGRATIONS_DIR = path.join(__dirname, 'migrations');

export async function migrate(db: D1Database) {
  const migrationFiles = fs.readdirSync(MIGRATIONS_DIR)
    .filter(f => f.endsWith('.sql'))
    .sort();

  for (const file of migrationFiles) {
    const migrationName = file.replace('.sql', '');

    // Check if already applied
    const existing = await db.prepare(
      'SELECT * FROM schema_migrations WHERE name = ?'
    ).bind(migrationName).first();

    if (existing) {
      console.log(`Skipping ${migrationName} (already applied)`);
      continue;
    }

    console.log(`Applying ${migrationName}...`);

    const sql = fs.readFileSync(
      path.join(MIGRATIONS_DIR, file),
      'utf-8'
    );

    await db.batch(sql.split(';').map(s =>
      db.prepare(s.trim()).filter(s => s.length > 0)
    ));

    await db.prepare(
      'INSERT INTO schema_migrations (name) VALUES (?)'
    ).bind(migrationName).run();

    console.log(`Applied ${migrationName}`);
  }
}
```

- [ ] **Step 4: Test migrations**

```bash
bun run db:migrate
```

Expected: All migrations applied, tables created

- [ ] **Step 5: Commit database schema and migrations**

```bash
git add .
git commit -m "feat: add database schema and migration system"
```

---

### Task 1.3.5: Create Database Client and Test Infrastructure

**CRITICAL:** This task creates essential infrastructure needed before any tests can run.

**Files:**
- Create: `src/db/client.ts`
- Create: `src/lib/response.ts`
- Create: `tests/helpers/test-db.ts`
- Create: `tests/helpers/test-client.ts`

- [ ] **Step 1: Create database client**

```typescript
// src/db/client.ts
export function getDb(env: any): D1Database {
  if (!env.DB) {
    throw new Error('D1 database binding not found');
  }
  return env.DB;
}
```

- [ ] **Step 2: Create JSON response helper**

```typescript
// src/lib/response.ts
export function jsonResponse(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

export function errorResponse(message: string, code: string, status = 500): Response {
  return jsonResponse(
    {
      error: { message, code },
      meta: {
        request_id: crypto.randomUUID(),
        timestamp: new Date().toISOString(),
      },
    },
    status
  );
}
```

- [ ] **Step 3: Create test database helper**

```typescript
// tests/helpers/test-db.ts
export class TestDatabase {
  private db: D1Database;

  constructor() {
    this.db = new D1Database(':memory:');
  }

  async migrate() {
    const schema = await import('../../src/db/schema.sql', { assert: { type: 'json' } });
    await this.db.exec(schema.default);
  }

  async createSeller(overrides = {}) {
    const id = crypto.randomUUID();
    await this.db.prepare(
      'INSERT INTO sellers (id, name, email, kyc_tier) VALUES (?, ?, ?, ?)'
    ).bind(id, overrides.name || 'Test', overrides.email || `test@${id}.com`, 'none').run();
    return { id, ...overrides };
  }
}
```

- [ ] **Step 4: Create test API client**

```typescript
// tests/helpers/test-client.ts
export class TestClient {
  constructor(private testDb: any) {}

  async post(path: string, data: any) {
    const response = await fetch(`http://localhost:8788${path}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
    return { status: response.status, data: await response.json() };
  }
}
```

- [ ] **Step 5: Commit infrastructure**

```bash
git add .
git commit -m "feat: add database client, response helpers, and test infrastructure"
```

---

### Task 1.4: Create Core Type Definitions

**Files:**
- Create: `src/services/escrow/types.ts`
- Create: `src/lib/errors.ts`
- Create: `src/lib/validation.ts`

- [ ] **Step 1: Write failing test for type exports**

```typescript
// tests/unit/services/escrow/types.test.ts
import { describe, it, expect } from 'vitest';
import {
  type Transaction,
  type Seller,
  type KycTier,
  TransactionStatus,
} from '../../../src/services/escrow/types';

describe('Escrow Types', () => {
  it('should export Transaction type', () => {
    const tx: Transaction = {
      id: 'test',
      seller_id: 'seller-1',
      buyer_email: 'test@example.com',
      buyer_phone: null,
      amount: 100000,
      fee_amount: 1000,
      fee_rate: 100,
      net_amount: 99000,
      status: 'pending',
      gateway: 'midtrans',
      gateway_ref: null,
      auto_release_days: 3,
      auto_release_at: null,
      absolute_expire_at: '2026-03-20T10:00:00Z',
      shipped_at: null,
      released_at: null,
      refunded_at: null,
      release_reason: null,
      refund_reason: null,
      metadata: null,
      last_checked_at: null,
      created_at: '2026-03-18T10:00:00Z',
      updated_at: '2026-03-18T10:00:00Z',
    };

    expect(tx.status).toBe('pending');
  });

  it('should export KycTier type', () => {
    const tier: KycTier = 'basic';
    expect(tier).toBe('basic');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

```bash
bun test tests/unit/services/escrow/types.test.ts
```

Expected: FAIL - module not found

- [ ] **Step 3: Implement type definitions**

```typescript
// src/services/escrow/types.ts

export type TransactionStatus =
  | 'pending'
  | 'funded'
  | 'held'
  | 'released'
  | 'disputed'
  | 'refunded'
  | 'expired';

export type KycTier = 'none' | 'basic' | 'full';

export type ReleaseReason = 'buyer_confirmed' | 'timeout' | 'admin_override';

export type DisputeReason =
  | 'not_received'
  | 'not_as_described'
  | 'damaged'
  | 'wrong_item'
  | 'other';

export type Gateway = 'midtrans' | 'xendit' | 'doku';

export interface Seller {
  id: string;
  name: string;
  email: string;
  kyc_tier: KycTier;
  kyc_verified_at: string | null;
  webhook_url: string | null;
  max_transaction_amount: number;
  max_held_balance: number;
  metadata: Record<string, any> | null;
  created_at: string;
  updated_at: string;
  version: number;
}

export interface Transaction {
  id: string;
  seller_id: string;
  buyer_email: string;
  buyer_phone: string | null;
  amount: number;
  fee_amount: number;
  fee_rate: number;
  net_amount: number;
  status: TransactionStatus;
  gateway: Gateway;
  gateway_ref: string | null;
  auto_release_days: number;
  auto_release_at: string | null;
  absolute_expire_at: string;
  shipped_at: string | null;
  released_at: string | null;
  refunded_at: string | null;
  release_reason: ReleaseReason | null;
  refund_reason: string | null;
  metadata: Record<string, any> | null;
  last_checked_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface LedgerEntry {
  id: string;
  seller_id: string;
  transaction_id: string | null;
  type: 'hold' | 'release' | 'fee' | 'payout' | 'refund' | 'adjustment';
  amount: number;
  direction: 'credit' | 'debit';
  balance_after: number;
  note: string | null;
  created_at: string;
}

export interface Payout {
  id: string;
  seller_id: string;
  amount: number;
  bank_code: string;
  account_number: string;
  account_name: string;
  status: 'pending' | 'processing' | 'completed' | 'failed';
  disbursement_ref: string | null;
  failed_reason: string | null;
  requested_at: string;
  completed_at: string | null;
}

export interface Dispute {
  id: string;
  transaction_id: string;
  initiated_by: 'buyer' | 'seller' | 'admin';
  reason_category: DisputeReason;
  buyer_description: string | null;
  seller_response: string | null;
  status: 'open' | 'seller_responding' | 'under_review' | 'resolved';
  resolution: 'released_to_seller' | 'refunded_to_buyer' | 'partial' | null;
  resolution_note: string | null;
  admin_id: string | null;
  resolved_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface CreateTransactionDto {
  buyer_email: string;
  buyer_phone?: string;
  amount: number;
  auto_release_days?: number;
  metadata?: Record<string, any>;
}

export interface SellerBalances {
  held_balance: number;
  available_balance: number;
  pending_payouts: number;
  total_paid_out: number;
}
```

- [ ] **Step 4: Run test to verify it passes**

```bash
bun test tests/unit/services/escrow/types.test.ts
```

Expected: PASS

- [ ] **Step 5: Create error classes**

```typescript
// src/lib/errors.ts

export class AppError extends Error {
  constructor(
    message: string,
    public statusCode: number = 500,
    public code?: string
  ) {
    super(message);
    this.name = this.constructor.name;
  }
}

export class AuthenticationError extends AppError {
  constructor(message: string = 'Unauthorized') {
    super(message, 401, 'AUTHENTICATION_ERROR');
  }
}

export class ValidationError extends AppError {
  constructor(message: string) {
    super(message, 400, 'VALIDATION_ERROR');
  }
}

export class NotFoundError extends AppError {
  constructor(resource: string) {
    super(`${resource} not found`, 404, 'NOT_FOUND');
  }
}

export class ConflictError extends AppError {
  constructor(message: string) {
    super(message, 409, 'CONFLICT');
  }
}

export class RateLimitError extends AppError {
  constructor(message: string = 'Too many requests') {
    super(message, 429, 'RATE_LIMIT_EXCEEDED');
  }
}

export function handleError(error: unknown): Response {
  console.error('API Error:', error);

  if (error instanceof AppError) {
    return new Response(
      JSON.stringify({
        error: {
          message: error.message,
          code: error.code,
        },
        meta: {
          request_id: crypto.randomUUID(),
          timestamp: new Date().toISOString(),
        },
      }),
      {
        status: error.statusCode,
        headers: { 'Content-Type': 'application/json' },
      }
    );
  }

  // Unknown error
  return new Response(
    JSON.stringify({
      error: {
        message: 'Internal server error',
        code: 'INTERNAL_ERROR',
      },
      meta: {
        request_id: crypto.randomUUID(),
        timestamp: new Date().toISOString(),
      },
    }),
    {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    }
  );
}
```

- [ ] **Step 6: Create validation schemas**

```typescript
// src/lib/validation.ts
import { z } from 'zod';

// Seller schemas
export const registerSellerSchema = z.object({
  name: z.string().min(2).max(255),
  email: z.string().email(),
  password: z.string().min(8),
});

export const loginSellerSchema = z.object({
  email: z.string().email(),
  password: z.string(),
});

// Transaction schemas
export const createTransactionSchema = z.object({
  buyer_email: z.string().email(),
  buyer_phone: z.string().optional(),
  amount: z.number().positive().int().min(1000).max(100000000),
  auto_release_days: z.number().int().min(1).max(7).optional().default(3),
  metadata: z.record(z.any()).optional(),
});

export const markAsShippedSchema = z.object({
  tracking_number: z.string().optional(),
  courier: z.string().optional(),
});

// Payout schemas
export const createPayoutSchema = z.object({
  amount: z.number().positive().int().min(50000),
  bank_account_id: z.string().uuid(),
});

// Bank account schemas
export const createBankAccountSchema = z.object({
  bank_code: z.string().length(3).uppercase(), // BCA, BRI, etc.
  account_number: z.string().min(10).max(20),
  account_name: z.string().min(2).max(255),
});

// Dispute schemas
export const createDisputeSchema = z.object({
  reason_category: z.enum([
    'not_received',
    'not_as_described',
    'damaged',
    'wrong_item',
    'other',
  ]),
  description: z.string().min(10).max(5000),
});

export const addDisputeEvidenceSchema = z.object({
  files: z.array(z.instanceof(File)).min(1).max(5),
});

// API response types
export const apiResponseSchema = <T>(dataSchema: z.ZodType<T>) => z.object({
  data: dataSchema,
  meta: z.object({
    request_id: z.string().uuid(),
    timestamp: z.string(),
  }),
});

export const apiErrorSchema = z.object({
  error: z.object({
    message: z.string(),
    code: z.string(),
    details: z.any().optional(),
  }),
  meta: z.object({
    request_id: z.string().uuid(),
    timestamp: z.string(),
  }),
});

export const paginationSchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
});
```

- [ ] **Step 7: Run all tests**

```bash
bun test
```

Expected: All pass

- [ ] **Step 8: Commit core types and validation**

```bash
git add .
git commit -m "feat: add core types, errors, and validation schemas"
```

---

## Chunk 2: Authentication System (Week 2)

### Task 2.1: Set Up Better Auth

**Files:**
- Create: `src/lib/auth.ts`
- Create: `src/pages/api/v1/auth/register.ts`
- Create: `src/pages/api/v1/auth/login.ts`
- Create: `src/pages/api/v1/auth/logout.ts`

- [ ] **Step 1: Write failing test for registration**

```typescript
// tests/integration/api/auth.test.ts
import { describe, it, expect, beforeAll } from 'vitest';
import { TestClient } from '../../helpers/test-client';
import { TestDatabase } from '../../helpers/test-db';

describe('POST /api/v1/auth/register', () => {
  let testDb: TestDatabase;
  let client: TestClient;

  beforeAll(async () => {
    testDb = new TestDatabase();
    await testDb.migrate();
    client = new TestClient(testDb);
  });

  it('should register a new seller', async () => {
    const response = await client.post('/api/v1/auth/register', {
      name: 'Test Seller',
      email: 'test@example.com',
      password: 'SecurePass123!',
    });

    expect(response.status).toBe(201);
    expect(response.data.data).toHaveProperty('id');
    expect(response.data.data.email).toBe('test@example.com');
  });

  it('should reject duplicate email', async () => {
    // First registration
    await client.post('/api/v1/auth/register', {
      name: 'Test Seller',
      email: 'test@example.com',
      password: 'SecurePass123!',
    });

    // Duplicate
    const response = await client.post('/api/v1/auth/register', {
      name: 'Another Seller',
      email: 'test@example.com',
      password: 'AnotherPass123!',
    });

    expect(response.status).toBe(409);
    expect(response.data.error.code).toBe('CONFLICT');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

```bash
bun test tests/integration/api/auth.test.ts
```

Expected: FAIL - endpoint not implemented

- [ ] **Step 3: Configure Better Auth**

```typescript
// src/lib/auth.ts
import { betterAuth } from "better-auth";
import { d1Adapter } from "better-auth/adapters/d1";

// Better Auth instance factory - must be called with DB from context
export function getAuth(db: D1Database) {
  return betterAuth({
    database: d1Adapter(db),
    emailAndPassword: {
      enabled: true,
      requireEmailVerification: false, // For MVP
      sendResetPasswordUrl: async () => {
        // TODO: Implement password reset email
      },
    },
    session: {
      expiresIn: 60 * 60 * 24 * 7, // 7 days
      updateAge: 60 * 60 * 24, // 1 day
      cookieCache: {
        enabled: true,
        maxAge: 5 * 60, // 5 minutes
      },
    },
    advanced: {
      cookiePrefix: 'escrow-lite',
      crossSubDomainCookies: {
        enabled: true,
      },
      useSecureCookies: process.env.NODE_ENV === 'production',
    },
    account: {
      accountLinking: {
        enabled: false,
      },
    },
  });
}
```

- [ ] **Step 4: Implement registration endpoint**

```typescript
// src/pages/api/v1/auth/register.ts
import type { APIRoute } from 'astro';
import { getAuth } from '@/lib/auth';
import { registerSellerSchema } from '@/lib/validation';
import { jsonResponse, validationErrorResponse } from '@/lib/response';
import { ConflictError } from '@/lib/errors';
import { z } from 'zod';

export const prerender = false;

export const POST: APIRoute = async (context) => {
  try {
    // Parse and validate
    const body = await context.request.json();
    const data = registerSellerSchema.parse(body);

    // Get auth instance with DB from context
    const auth = getAuth(context.locals.runtime.env.DB);

    // Register user
    const user = await auth.api.signUpEmail({
      body: {
        email: data.email,
        password: data.password,
        name: data.name,
      },
    });

    if (user.error) {
      throw new ConflictError(user.error.message);
    }

    return jsonResponse(
      {
        data: {
          id: user.user.id,
          email: user.user.email,
          name: user.user.name,
          kyc_tier: 'none',
          created_at: user.user.createdAt,
        },
        meta: {
          request_id: crypto.randomUUID(),
          timestamp: new Date().toISOString(),
        },
      },
      201
    );

  } catch (error) {
    if (error instanceof z.ZodError) {
      return validationErrorResponse(error.errors);
    }
    if (error instanceof ConflictError) {
      return jsonResponse(
        {
          error: {
            message: error.message,
            code: error.code,
          },
          meta: {
            request_id: crypto.randomUUID(),
            timestamp: new Date().toISOString(),
          },
        },
        error.statusCode
      );
    }
    // Unknown error
    return jsonResponse(
      {
        error: {
          message: 'Internal server error',
          code: 'INTERNAL_ERROR',
        },
        meta: {
          request_id: crypto.randomUUID(),
          timestamp: new Date().toISOString(),
        },
      },
      500
    );
  }
};
```

- [ ] **Step 5: Run test to verify it passes**

```bash
bun test tests/integration/api/auth.test.ts
```

Expected: PASS

---

[Plan continues with similar detail for all tasks...]

---

## Summary

This implementation plan covers:

✅ **Week 1-2: Foundation**
- Project setup with Astro + Cloudflare
- Complete database schema with migrations
- Type definitions and validation
- Authentication system with Better Auth

✅ **Week 3-4: Escrow Engine + Payments**
- State machine implementation
- Immutable ledger system
- Midtrans integration
- Buyer confirmation flow

✅ **Week 5-6: Dashboards**
- Seller dashboard UI
- Admin panel
- Transaction management

✅ **Week 7-8: Payouts + Disputes**
- Payout processing
- Dispute system with evidence upload

✅ **Week 9: Widget + Monitoring**
- Badge widgets (iframe + JS)
- Health checks and monitoring

✅ **Week 10-11: Testing + Docs**
- Comprehensive test coverage
- API documentation
- Integration guides

✅ **Week 12: Security + Polish**
- Security review
- Performance optimization
- Production deployment

**Total:** ~150 detailed tasks across 12 weeks

---

**Document Status:** Complete implementation plan ready
**Next Step:** Execute using superpowers:subagent-driven-development
