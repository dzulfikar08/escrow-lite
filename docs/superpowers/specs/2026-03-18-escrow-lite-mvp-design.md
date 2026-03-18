# Escrow Lite MVP Design Document

**Date:** 2026-03-18
**Status:** Approved with Changes
**Version:** 1.1 (Updated post-design review)

## Executive Summary

This document outlines the design and architecture for building the Escrow Lite MVP - a trust layer for Indonesian independent sellers. The platform sits between seller websites and payment gateways, holding buyer funds in escrow until buyers confirm receipt of goods.

**Tech Stack:**
- **Framework:** Astro (all-in approach)
- **Database:** Cloudflare D1 (SQLite)
- **Hosting:** Cloudflare Workers/Pages
- **Payment:** Midtrans (with placeholder credentials for MVP)
- **Authentication:** Better Auth
- **Email:** Cloudflare Email Workers
- **Storage:** Cloudflare R2 (for dispute evidence)

## 1. Overall Architecture

### High-Level Architecture

```
┌─────────────────────────────────────────────────────────┐
│              Astro Application (Cloudflare)             │
│                                                          │
│  Pages (UI) → API Routes → Service Layer → Data Layer   │
│                                                          │
└─────────────────────────────────────────────────────────┘
                          │
        ┌─────────────────┼─────────────────┐
        ▼                 ▼                 ▼
┌──────────────┐  ┌──────────────┐  ┌──────────────┐
│  D1 Database │  │     R2       │  │   Midtrans   │
└──────────────┘  └──────────────┘  └──────────────┘
```

### Project Structure

```
src/
├── pages/           # Astro pages & API routes
│   ├── dashboard/   # Seller dashboard
│   ├── admin/       # Admin panel
│   ├── api/v1/      # REST API
│   └── badge/       # Widget endpoints
├── services/        # Business logic layer
│   ├── escrow/      # State machine & ledger
│   ├── payments/    # Midtrans integration
│   ├── payouts/     # Payout processing
│   ├── webhooks/    # Webhook delivery
│   ├── kyc/         # KYC abstraction
│   └── auth/        # Better Auth
├── db/              # D1 database queries
├── components/      # UI components
├── lib/             # Utilities
└── layouts/         # Astro layouts
```

## 2. Database Schema (D1/SQLite)

### Key Adaptations from PostgreSQL

| PostgreSQL | D1/SQLite | Notes |
|------------|-----------|-------|
| `UUID` | `TEXT` | Generated in application |
| `BIGINT` | `INTEGER` | 64-bit integers |
| `ENUM` | `TEXT` + `CHECK` | Validation constraint |
| `JSONB` | `TEXT` | JSON as string |
| `TIMESTAMP` | `TEXT` | ISO 8601 format |

### Core Tables

**sellers** - Seller accounts with KYC tiers
**transactions** - Escrow transactions with state tracking
**ledger_entries** - Immutable audit trail of all balance changes
**payouts** - Seller payout requests
**disputes** - Buyer dispute records
**dispute_evidence** - Evidence files (R2 URLs)
**webhook_delivery_log** - Outbound webhook tracking
**api_keys** - Seller API keys (hashed)
**admin_users** - Admin accounts
**audit_log** - All admin actions logged

### Balance Calculation

```sql
-- Held balance (transactions in 'held' or 'disputed' status)
SELECT COALESCE(SUM(net_amount), 0)
FROM transactions
WHERE seller_id = ? AND status IN ('held', 'disputed')

-- Available balance (from ledger)
SELECT balance_after
FROM ledger_entries
WHERE seller_id = ?
ORDER BY created_at DESC
LIMIT 1
```

## 3. Escrow Engine & State Machine

### State Machine

```
PENDING → FUNDED → HELD → RELEASED → PAID_OUT
                    ↘ DISPUTED → RESOLVED → RELEASED/REFUNDED
                    ↘ EXPIRED (auto-release)
```

### Key Transitions

- **create()**: Create new transaction, calculate fees
- **markAsFunded()**: Payment received, move to HELD
- **markAsShipped()**: Start auto-release timer
- **buyerConfirm()**: Buyer confirms receipt
- **adminRelease()**: Admin manual override
- **openDispute()**: Buyer opens dispute
- **checkTimeouts()**: Cron job for auto-release

### Fee Calculation

- **Minimum**: Rp 1,000 per transaction
- **Rate**: 1% flat for MVP
- **Tiered**: Phase 2 (0.5-1% based on volume)

## 4. API Architecture

### API Endpoints

```
/api/v1/auth          - Registration, login
/api/v1/transactions  - CRUD, ship, confirm
/api/v1/payouts       - Request, list payouts
/api/v1/webhooks      - Configure webhooks
/api/v1/bank-accounts - Manage payout accounts
/api/v1/seller        - Profile, balance
/api/external/webhooks/midtrans - Payment gateway callbacks

/admin/api/           - Admin panel APIs
```

### Authentication

- **Dashboard**: Better Auth (session-based)
- **API**: Bearer token (API key, SHA-256 hashed)
- **Admin**: Better Auth with role-based access

### Error Handling

All errors follow consistent format:
```json
{
  "error": {
    "message": "Human-readable message",
    "code": "ERROR_CODE",
    "details": {}
  },
  "meta": {
    "request_id": "uuid",
    "timestamp": "ISO-8601"
  }
}
```

## 5. Security & Compliance

### API Key Security

- Keys generated as `esc_live_<random>`
- SHA-256 hashed before storage
- Prefix stored for identification
- Rotation supported via dashboard

### Webhook Security

- HMAC-SHA256 signature
- Timestamp validation (15-minute window)
- Format: `t=timestamp,v1=signature`

### Data Encryption

- AES-256-GCM for bank accounts
- Encryption key from Cloudflare secret
- Encrypted data stored as JSON in database

### Fund Segregation

- Immutable ledger (append-only)
- Balance always calculated from history
- Audit trail for all admin actions
- Negative balances prevented

### Indonesian Compliance

- **KYC Tiers**: None, Basic, Full
- **Tier Limits**:
  - None: Rp 1M max transaction, Rp 5M held
  - Basic: Rp 10M max transaction, Rp 50M held
  - Full: Unlimited
- **Data Privacy**: PDPA compliant, data stored in Indonesia
- **Audit**: All actions logged with reason

## 6. Testing Strategy

### Test Structure

```
tests/
├── unit/         - Service logic tests
├── integration/  - API endpoint tests
└── e2e/          - Full flow tests
```

### Coverage Goals

- **Unit Tests**: 80%+ coverage on services
- **Integration Tests**: All API endpoints
- **E2E Tests**: Critical flows (payment, release, dispute)

## 7. Deployment

### Cloudflare Configuration

```toml
# wrangler.toml
name = "escrow-lite"
[[d1_databases]]
binding = "DB"
database_id = "YOUR_D1_ID"

[[r2_buckets]]
binding = "STORAGE"
bucket_name = "escrow-lite-evidence"
```

### Environments

- **Development**: Local with `wrangler dev`
- **Staging**: Cloudflare Workers (testing)
- **Production**: Cloudflare Workers (live)

### CI/CD

- GitHub Actions for testing
- Automated deployment on merge to main
- Manual approval for production releases

## 8. Implementation Order

### Week 1-2: Foundation
- Project setup
- Database schema & migrations
- Authentication system
- Core types & models

### Week 3: Escrow Engine
- State machine implementation
- Ledger system
- Transaction management

### Week 4: Payment Integration
- Midtrans integration
- Webhook handling
- Buyer confirmation flow

### Week 5: Seller Dashboard
- Dashboard UI
- Transaction list
- Balance overview
- Payout requests

### Week 6: Admin Panel
- Admin authentication
- Transaction management
- Manual release interface

### Week 7: Payouts
- Payout service
- Bank transfer logic (stub)
- Payout scheduling

### Week 8: Disputes
- Dispute creation
- Evidence upload (R2)
- Admin resolution

### Week 9: Badge Widget
- Iframe version
- JS snippet version
- Customization options

### Week 10: Testing & Polish
- Comprehensive testing
- Documentation
- Security review

## 9. Key Design Decisions

### Why All-in Astro?

- **Simplicity**: Single deployment, easier iteration
- **Cost-effective**: Cloudflare free tier for MVP
- **Scalable**: Can extract services later if needed
- **Modern**: Latest Astro features, server-first

### Why D1 over PostgreSQL?

- **Cloudflare native**: No separate database hosting
- **Cost-effective**: Free tier generous for MVP
- **Fast**: Edge-located database
- **Sufficient**: SQLite handles MVP requirements

### Why Better Auth?

- **Modern**: Latest auth library for TypeScript
- **Cloudflare compatible**: Works with Workers
- **Flexible**: Supports multiple auth methods
- **Secure**: Built-in session management

### Why Immutable Ledger?

- **Audit**: Complete history of all changes
- **Debugging**: Easy to trace balance issues
- **Compliance**: Regulatory requirement
- **Reliability**: Never update, always append

## 10. Risks & Mitigations

| Risk | Mitigation |
|------|------------|
| D1 limitations | Monitor usage, migrate to PostgreSQL if needed |
| Midtrans downtime | Add Xendit in Phase 2 |
| Scaling performance | Extract services to separate Workers |
| Security vulnerabilities | Code audit, penetration testing |
| Regulatory changes | Consult legal, build flexibility |

## 11. Success Criteria

### Functional

- [ ] Sellers can create transactions
- [ ] Buyers can complete payment
- [ ] Funds held in escrow properly
- [ ] Auto-release on timeout works
- [ ] Manual release works
- [ ] Disputes can be created and resolved
- [ ] Payouts can be requested and processed
- [ ] Badge widget embeds correctly

### Non-Functional

- [ ] API response time < 300ms (p95)
- [ ] 99.9% uptime
- [ ] All tests passing
- [ ] 80%+ test coverage
- [ ] Security audit passed
- [ ] Documentation complete

### Business

- [ ] 5 test sellers onboarded
- [ ] 100 test transactions processed
- [ ] < 1% error rate
- [ ] Positive user feedback

## 12. Next Steps

1. **Review this design** with stakeholders
2. **Set up development environment**
3. **Create GitHub project board** with tasks
4. **Begin implementation** starting with Phase 1
5. **Weekly progress reviews**

---

## 13. Design Review Updates (Post-Review)

### 13.1 Critical Issues Addressed

The following critical issues were identified during design review and have been addressed in this updated version:

#### Issue #1: Idempotency Implementation
**Added**: Section 4.1 - Idempotency Keys table and middleware

```sql
CREATE TABLE idempotency_keys (
  key TEXT PRIMARY KEY,
  seller_id TEXT NOT NULL,
  request_hash TEXT,  -- SHA-256 of request body
  response_json TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  expires_at TEXT NOT NULL  -- 48 hours
);

CREATE INDEX idx_idempotency_expiry ON idempotency_keys(expires_at);
```

Implementation: Middleware checks for existing idempotency key before processing, returns cached response if found.

#### Issue #2: Cron/Scheduling for Auto-Release
**Added**: Section 3.5 - Scheduled Jobs using Cloudflare Cron Triggers

```toml
# wrangler.toml
[triggers]
crons = ["*/5 * * * *"]  # Check timeouts every 5 minutes
```

Added `last_checked_at` timestamp to transactions table for idempotency. Time zone handling: all timestamps stored as UTC in ISO 8601 format.

#### Issue #3: Webhook Retry Logic
**Added**: Section 5.3 - Webhook Delivery with Exponential Backoff

State machine:
```
PENDING → SENT → ACKNOWLEDGED
    ↘ FAILED → RETRYING → DEAD_LETTERED
```

Retry schedule: 1m, 5m, 30m, 2h, 6h, 24h, then dead letter. Max 7 attempts.

#### Issue #4: Database Migration Strategy
**Added**: Section 2.5 - Migration System

```
migrations/
  001_initial_schema.sql
  002_add_idempotency.sql
  003_add_indexes.sql
```

Runner tracks applied migrations in `schema_migrations` table. Rollback via `down.sql` files.

#### Issue #5: Fund Segregation Architecture
**Added**: Section 5.4 - Fund Flow & Reconciliation

```
Buyer Payment → Midtrans → Escrow Ledger → Seller Payout
                     ↓              ↓
              Virtual Account   Reconciliation Job
                                (runs daily)
```

Funds held in Midtrans virtual account. Ledger is source of truth. Reconciliation job runs daily to match Midtrans balances vs ledger.

#### Issue #6: Database Transaction Semantics
**Added**: Section 2.6 - Optimistic Concurrency Control

Using D1 batched statements for atomic operations. Added `version` column to sellers table for optimistic locking on balance updates.

#### Issue #7: Monitoring & Observability
**Added**: Section 9 - Monitoring Strategy

- Cloudflare Analytics for basic metrics
- Health check endpoint: `GET /health`
- Error tracking via Cloudflare Logs
- Uptime measured via external ping (cron-job.org)
- SLO: 99.9% uptime (~43min/month downtime budget)

### 13.2 Database Indexes Added

**Critical Indexes** (added to Section 2):

```sql
-- Balance queries (most frequent)
CREATE INDEX idx_ledger_seller_created ON ledger_entries(seller_id, created_at DESC);

-- Transaction filtering
CREATE INDEX idx_transactions_seller_status ON transactions(seller_id, status);
CREATE INDEX idx_transactions_status_created ON transactions(status, created_at);

-- Timeout checks (runs every 5 min)
CREATE INDEX idx_transactions_auto_release ON transactions(auto_release_at)
  WHERE status IN ('held', 'disputed');

-- Webhook processing
CREATE INDEX idx_webhooks_next_retry ON webhook_delivery_log(status, next_retry_at);

-- Payout processing
CREATE INDEX idx_payouts_status_created ON payouts(status, created_at);

-- Idempotency cleanup
CREATE INDEX idx_idempotency_expiry ON idempotency_keys(expires_at);
```

### 13.3 Updated Timeline

**Extended from 10 weeks to 12 weeks** to account for:
- State machine edge cases
- Midtrans integration complexity
- Webhook retry system
- Comprehensive testing

**Revised Schedule:**
- Week 1-2: Foundation (same)
- Week 3-4: Escrow Engine + Payments (expanded)
- Week 5-6: Dashboards (same)
- Week 7-8: Payouts + Disputes (expanded)
- Week 9: Badge Widget + Monitoring (same)
- Week 10-11: Testing & Documentation (expanded)
- Week 12: Security Review & Polish (new)

### 13.4 API Documentation Strategy

**Added**: OpenAPI 3.0 spec will be generated from code. API documentation hosted at `/docs` using Astro + Scalar or Redoc.

Example SDKs:
- JavaScript/TypeScript (official)
- cURL examples in docs
- Postman collection for testing

### 13.5 Local Development Guide

**Added**: Section 10 - Development Setup

```bash
# Prerequisites
- Node.js 22+
- Bun (package manager)
- Wrangler CLI

# Setup
1. Clone repo
2. bun install
3. cp .dev.vars.example .dev.vars
4. wrangler d1 create escrow-lite-dev  # Local D1
5. bun run db:migrate
6. bun run dev

# Development
- Astro dev server: http://localhost:4321
- D1 local mode: .wrangler/state/v3/d1/miniflare-D1DatabaseObject
- Email logs to console
- Midtrans: Use sandbox mode
```

### 13.6 Buyer Confirmation Security

**Enhanced**: Single-use tokens with 15-minute expiry

```sql
CREATE TABLE confirmation_tokens (
  token TEXT PRIMARY KEY,
  transaction_id TEXT NOT NULL,
  expires_at TEXT NOT NULL,
  used_at TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX idx_confirmation_tokens_expiry ON confirmation_tokens(expires_at);
```

Token sent via email link. Check `used_at` is NULL before confirming. Expire tokens after 15 minutes.

### 13.7 Backup Strategy

**Added**: Section 11 - Data Backup & Recovery

- Daily D1 exports to R2 (automated via Cloudflare Workers)
- Retention: 30 days in R2 standard, then move to Glacier
- Weekly restore drills (automated test)
- Backup includes: D1 database, R2 evidence files, encryption keys

**Recovery Procedure:**
1. Create new D1 database
2. Import latest backup
3. Update wrangler.toml with new database_id
4. Verify checksums
5. Switch DNS

### 13.8 State Machine Clarification

**Clarified**: `FUNDED` vs `HELD` states

- `FUNDED`: Payment received from gateway, funds secured
- `HELD`: Funds allocated to seller balance, available for release
- Transition `FUNDED → HELD` is immediate for MVP, kept separate for:
  - Future: Manual review step for high-value transactions
  - Audit trail clarity
  - Potential for `FUNDED → REFUNDED` (before `HELD`)

### 13.9 Fee Calculation

**Clarified**: 1% flat rate for MVP

- Minimum: Rp 1,000 per transaction
- Maximum: None (unlimited for MVP)
- Calculation: `fee = max(amount * 0.01, 1000)`
- Phase 2: Tiered pricing based on seller volume

### 13.10 Auto-Release Timeouts

**Clarified**: Two independent timeouts

1. **Delivery timeout**: 3 days (configurable per seller) after `shipped_at`
2. **Absolute timeout**: 14 days after `created_at` (regardless of shipment)

Whichever comes first triggers auto-release. Cron job checks both every 5 minutes.

### 13.11 KYC Simplified for MVP

**Updated**: Manual KYC review for MVP

- Remove KYC provider integration complexity
- Admin can manually set KYC tier (none/basic/full)
- Seller uploads documents via dashboard
- Admin reviews and approves/rejects
- Phase 2: Integrate Verihubs/Privy

### 13.12 Rate Limiting

**Added**: Cloudflare Workers KV for rate limiting

```typescript
// Per-endpoint limits
const LIMITS = {
  'create_transaction': { requests: 10, period: 60 },  // 10/min
  'default': { requests: 100, period: 60 },  // 100/min
  'webhook': { requests: 1000, period: 60 },  // 1000/min
};
```

Implementation: Token bucket algorithm with KV storage.

### 13.13 Payout Fraud Prevention

**Added**: Basic fraud rules for MVP

- Bank accounts must be added 48 hours before first payout
- First payout requires manual admin approval
- Max 1 payout per day for first week
- Graduated limits based on payout history

---

**Document Status:** Approved with Changes - Critical issues resolved
**Next Steps:** Proceed to implementation planning
**Implementation Timeline:** 12 weeks (revised from 10)

---

## 14. Implementation Checklist

### Week 1-2: Foundation
- [ ] Set up Astro project with Cloudflare adapter
- [ ] Configure D1 database and run initial migrations
- [ ] Implement Better Auth with seller registration
- [ ] Create API key generation and authentication
- [ ] Set up validation schemas (Zod)
- [ ] Configure ESLint, Prettier, TypeScript

### Week 3-4: Escrow Engine + Payments
- [ ] Implement escrow state machine
- [ ] Create immutable ledger system
- [ ] Build balance calculation service
- [ ] Add idempotency middleware
- [ ] Integrate Midtrans payment flow
- [ ] Implement webhook signature verification
- [ ] Create buyer confirmation flow
- [ ] Add auto-release cron job

### Week 5-6: Dashboards
- [ ] Build seller dashboard layout
- [ ] Create transaction list/detail views
- [ ] Implement balance overview
- [ ] Add payout request form
- [ ] Build admin panel layout
- [ ] Create admin transaction management
- [ ] Add manual release interface

### Week 7-8: Payouts + Disputes
- [ ] Implement payout service
- [ ] Create payout scheduling
- [ ] Add bank account verification (penny drop stub)
- [ ] Build dispute creation flow
- [ ] Implement R2 evidence upload
- [ ] Create admin resolution interface
- [ ] Add dispute state machine

### Week 9: Widget + Monitoring
- [ ] Create iframe badge widget
- [ ] Implement JS snippet widget
- [ ] Add customization options
- [ ] Set up health check endpoint
- [ ] Configure error tracking
- [ ] Add logging strategy

### Week 10-11: Testing + Documentation
- [ ] Complete unit tests (80%+ coverage)
- [ ] Write integration tests
- [ ] Create E2E test scenarios
- [ ] Generate OpenAPI spec
- [ ] Write API documentation
- [ ] Create seller integration guide
- [ ] Document deployment process

### Week 12: Security + Polish
- [ ] Security audit and fixes
- [ ] Performance optimization
- [ ] Load testing
- [ ] User acceptance testing
- [ ] Production deployment preparation
- [ ] Final documentation review

---

**Ready for implementation planning phase**
