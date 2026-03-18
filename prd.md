# Product Requirements Document (PRD)
# Escrow Lite — Trust Layer for Independent Indonesian Sellers

**Version:** 1.2
**Status:** Draft
**Last Updated:** March 18, 2026
**Owner:** Product Team

> **Implementation Note:** This MVP will be built using Astro + Cloudflare D1 database (SQLite-based). The original PRD specified PostgreSQL; this has been updated to D1 for cost-effectiveness and Cloudflare native integration. The schema and architecture have been adapted accordingly.

---

## 1. Executive Summary

Escrow Lite is a SaaS "trust layer" that sits between an independent seller's website and their payment gateway, holding buyer funds in escrow until the buyer confirms receipt of goods. It is purpose-built for Indonesian independent sellers and small marketplace operators who want the fraud protection of a large e-commerce platform (Tokopedia, Shopee) without the 2–5% platform fees and loss of brand ownership.

The product solves a critical gap: payment gateways (Midtrans, Xendit, DOKU) confirm money movement, but they do **not** protect buyers from fraud. Escrow Lite adds that protection as a thin, embeddable layer on top of any existing gateway.

---

## 2. Problem Statement

### 2.1 Market Context

Indonesia's e-commerce market is one of Southeast Asia's largest, but it is heavily concentrated in a few large platforms. Sellers who graduate to their own D2C websites gain margin and brand control but immediately lose structural trust mechanisms that marketplaces provide.

| Channel | Marketplace Fee | Escrow | Buyer Trust |
|---|---|---|---|
| Tokopedia / Shopee | 2–5% + 1–2% payment | ✅ Built-in | ✅ High |
| Independent website (gateway only) | 0.7–1.5% MDR | ❌ None | ⚠️ Low |
| **Escrow Lite** | ~0.5–1% (target) | ✅ Built-in | ✅ High |

### 2.2 Core Problems

**For buyers:**
- No guarantee that goods will be shipped after payment.
- No recourse mechanism if goods don't arrive or arrive damaged.
- Low willingness to pay large amounts (furniture, electronics, fashion) to unfamiliar brand websites.

**For sellers:**
- Conversion rate on D2C sites is significantly lower than on marketplaces, even for established brands.
- Word-of-mouth damage from a single fraud incident is disproportionately high.
- No affordable, developer-friendly escrow API exists in the Indonesian market.

**Market gap:**
The existing Indonesian "rekber" (rekening bersama) concept is manual, WhatsApp-based, and doesn't scale. No API-native, embeddable escrow product exists for Indonesian SME sellers as of 2026.

### 2.3 Why Now

- Bank Indonesia's SNAP (Standar Nasional API Pembayaran) has matured, making multi-gateway integration more standardized.
- OJK's digital finance regulations now provide clearer licensing paths for fund-holding products.
- E-commerce fraud complaints filed to BPKN have risen year-on-year, signaling pent-up buyer demand for protection.

---

## 3. Goals & Success Metrics

### 3.1 Business Goals

- Become the default escrow middleware for Indonesian independent seller websites.
- Reach 500 active seller integrations within 12 months of launch.
- Achieve net revenue positive by Month 18.

### 3.2 Product Goals

- Increase buyer checkout conversion rate on seller sites by ≥15%.
- Reduce seller-reported buyer fraud claims to near zero.
- Achieve payout SLA compliance ≥99%.
- Keep integration effort under 1 day for a solo developer using the REST API.

### 3.3 Key Metrics (KPIs)

| Metric | Definition | Target (Month 12) |
|---|---|---|
| Active sellers | Sellers with ≥1 transaction in last 30 days | 500 |
| GMV processed | Total transaction volume through escrow | Rp 50B / month |
| Buyer conversion lift | A/B tested uplift vs. no-escrow checkout | ≥15% |
| Dispute rate | Disputes / total transactions | <2% |
| Auto-release rate | Transactions released without dispute | >90% |
| Payout SLA breach | Payouts not completed within SLA | <1% |
| Seller churn (monthly) | Sellers deactivating integration | <5% |

---

## 4. Target Users & Personas

### 4.1 Primary — Sellers

**Persona A: Independent Brand Owner ("Rina")**
- Runs a clothing brand with her own Shopify/WooCommerce site.
- Average order value: Rp 300,000–800,000.
- Already uses Midtrans or Xendit.
- Pain: Buyers don't trust paying upfront; COD is operationally difficult.
- Need: A trust badge + escrow that's easy to install and cheap.

**Persona B: SME Electronics Reseller ("Budi")**
- Sells refurbished phones via a custom website.
- Average order value: Rp 1,500,000–5,000,000.
- High fraud risk on both sides (fake buyers, chargebacks).
- Need: Escrow protection for high-value transactions, dispute evidence system.

### 4.2 Secondary — Buyers

**Persona C: First-time D2C Buyer ("Siti")**
- Familiar with Tokopedia/Shopee but found this brand via Instagram.
- Reluctant to pay upfront on an unfamiliar website.
- Will complete purchase if she sees a verified escrow badge.

### 4.3 Tertiary — Small Marketplace Operators

Operators running niche marketplaces (handmade crafts, local food, secondhand goods) who want built-in escrow without building it themselves.

---

## 5. Scope & Feature Requirements

### 5.1 In-Scope (MVP — Phase 1)

| Feature | Priority |
|---|---|
| Payment hold via gateway integration | P0 |
| Auto-release on buyer confirmation | P0 |
| Auto-release on timeout | P0 |
| Seller dashboard (balance, transactions, payouts) | P0 |
| Payout to Indonesian bank accounts | P0 |
| Rekber Badge Widget (embeddable) | P0 |
| Webhook notifications to seller | P0 |
| Basic dispute submission | P1 |
| Admin dispute management panel | P1 |

### 5.2 Out of Scope (Phase 1)

- Multi-currency support
- Buyer-side app or login portal
- AI-based fraud scoring
- Full OJK payment institution licensing (use partner license for Phase 1)
- Logistics API integration (tracking)

---

## 6. Core Feature Specifications

### 6.1 Payment Hold (Escrow)

**Flow:**
1. Seller creates a transaction via API, specifying amount, buyer contact, and release conditions.
2. Buyer receives a payment link (hosted by Escrow Lite or embeddable in seller's checkout).
3. Buyer completes payment via existing gateway (Midtrans / Xendit / DOKU).
4. On successful payment callback, funds are marked `HELD` in the Escrow Lite ledger.
5. Seller receives a webhook: `transaction.funded`.

**Status States:**
```
PENDING → FUNDED → HELD → RELEASED → PAID_OUT
                       ↘ DISPUTED → RESOLVED → RELEASED / REFUNDED
                       ↘ EXPIRED (timeout, auto-release triggered)
```

**Business Rules:**
- Funds are held in a segregated sub-account or virtual account, not commingled with Escrow Lite operating funds.
- Seller cannot initiate payout while status is `HELD` or `DISPUTED`.
- Escrow Lite holds funds; payout is only to pre-verified seller bank accounts.

### 6.2 Auto-Release

Two triggers, whichever comes first:

| Trigger | Condition | Default Timeout |
|---|---|---|
| Buyer confirmation | Buyer clicks "I've received my order" via email link or API call | — |
| Delivery timeout | N days after order marked "shipped" by seller | 3 days (configurable per seller, 1–7 days) |
| Absolute timeout | M days after payment, regardless of shipment status | 14 days |

On trigger: status moves to `RELEASED`, seller is notified via webhook (`transaction.released`), and funds become available for payout.

### 6.3 Manual Release / Admin Override

- Platform admin can manually release or freeze funds.
- All manual actions must have a mandatory reason field and are logged in the audit trail.
- Sellers can request early release; admin reviews and approves.

### 6.4 Dispute System

**Buyer-Initiated Dispute:**
1. Buyer clicks dispute link in email (valid only while status is `HELD`).
2. Buyer submits: reason category, description, optional photo/video evidence (max 5 files, 10MB each).
3. Status moves to `DISPUTED`, funds are frozen.
4. Seller receives notification and has 3 business days to respond with counter-evidence.
5. Admin reviews both sides and makes a binding decision within 5 business days.
6. Resolution: full release to seller, partial release, or full refund to buyer.

**Reason Categories:**
- Item not received
- Item significantly not as described
- Item damaged on arrival
- Wrong item sent
- Other

**Escalation:**
- If admin cannot resolve within SLA, case escalates to senior admin.
- Seller and buyer are notified at each stage.

**Non-Scope (Phase 1):** Automated fraud detection, third-party arbitration, legal escalation pathway.

### 6.5 Seller Dashboard

**Balance Summary:**
- Held balance (locked, cannot be paid out)
- Available balance (released, ready to pay out)
- Pending payout (in process)
- All-time paid out

**Transaction List:**
- Filterable by status, date range, amount.
- Each transaction shows: buyer identifier (masked), amount, status, timestamps, release reason.

**Payout Management:**
- Request payout (minimum Rp 50,000).
- Payout to registered bank account(s).
- Payout history with status.
- Bank account management (add, verify, set default).

**Analytics (Phase 2):**
- Conversion rate trend (if seller installs JS snippet).
- Dispute rate over time.
- Average hold duration.

### 6.6 Rekber Badge Widget

An embeddable trust signal for seller product/checkout pages.

**Implementation options:**
- `<iframe>` embed (simplest, no JS required)
- JS snippet (more control, loads asynchronously)

**Displays:**
- Seller verification tier (Unverified / Basic KYC / Full KYC)
- "Pembayaran dilindungi Escrow Lite" (Payment protected by Escrow Lite)
- Auto-release policy summary
- Link to buyer protection page (hosted by Escrow Lite)

**Variants:**
- Compact (horizontal bar, for checkout page header)
- Card (for product detail pages)
- Floating badge (sticky, bottom corner)

**Customization:**
- Color accent (to match brand)
- Language: Bahasa Indonesia / English

---

## 7. User Flows

### 7.1 Buyer Flow (Full)

```
[Seller's Product Page]
        │
        ▼
[Sees Rekber Badge — "Pembayaran Dilindungi"]
        │
        ▼
[Checkout → Payment Page]
        │
        ▼
[Pays via payment gateway (VA, QRIS, card)]
        │
        ▼
[Email: "Pembayaran diterima — dana ditahan sampai kamu konfirmasi"]
        │
        ├──[Goods arrive]──▶ [Clicks "Konfirmasi Terima Barang"] ──▶ [Funds Released]
        │
        ├──[No action]──▶ [Auto-release after timeout] ──▶ [Funds Released]
        │
        └──[Problem]──▶ [Clicks "Ajukan Komplain"] ──▶ [Dispute Flow]
```

### 7.2 Seller Flow (Full)

```
[Registers & integrates API]
        │
        ▼
[Creates transaction via POST /transactions]
        │
        ▼
[Receives webhook: transaction.funded]
        │
        ▼
[Ships goods, marks order as shipped via API or dashboard]
        │
        ▼
[Receives webhook: transaction.released]
        │
        ▼
[Requests payout via dashboard or POST /payouts]
        │
        ▼
[Bank transfer completed within SLA]
```

### 7.3 Dispute Flow (Full)

```
Buyer submits dispute
        │
        ▼
Status → DISPUTED (funds frozen)
        │
        ▼
Seller notified → submits response (3 business days)
        │
        ▼
Admin reviews evidence (5 business days)
        │
        ├──[Seller wins]──▶ funds released to seller
        ├──[Buyer wins]──▶ full refund to buyer (gateway refund)
        └──[Partial]──▶ split per admin decision
```

---

## 8. System Architecture

### 8.1 High-Level Components

```
┌─────────────────────────────────────────────────────────┐
│                    Seller Website                        │
│  (WooCommerce / Shopify / Custom)                        │
│  ┌──────────────┐   ┌──────────────────────────────┐   │
│  │ Rekber Badge │   │ Checkout (API-created tx link)│   │
│  └──────────────┘   └──────────────────────────────┘   │
└─────────────────────────────────────────────────────────┘
               │                       │
               ▼                       ▼
┌─────────────────────────────────────────────────────────┐
│              Escrow Lite Platform                        │
│                                                          │
│  ┌──────────────────┐   ┌────────────────────────────┐  │
│  │   REST API       │   │  Webhook Engine            │  │
│  │  (Node.js / Go)  │   │  (event fan-out to sellers)│  │
│  └──────────────────┘   └────────────────────────────┘  │
│  ┌──────────────────┐   ┌────────────────────────────┐  │
│  │  Escrow Engine   │   │  Payout Engine             │  │
│  │  (state machine) │   │  (bank transfer scheduler) │  │
│  └──────────────────┘   └────────────────────────────┘  │
│  ┌──────────────────┐   ┌────────────────────────────┐  │
│  │   Admin Panel    │   │  Seller Dashboard          │  │
│  └──────────────────┘   └────────────────────────────┘  │
│  ┌──────────────────────────────────────────────────┐   │
│  │   PostgreSQL (primary DB)   │   Redis (queues)   │   │
│  └──────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────┘
               │
               ▼
┌─────────────────────────────────────────────────────────┐
│           Payment Gateway Layer                          │
│   Midtrans  │  Xendit  │  DOKU  │  (future: others)     │
└─────────────────────────────────────────────────────────┘
               │
               ▼
┌─────────────────────────────────────────────────────────┐
│           Bank Transfer / Payout Rail                    │
│   BI-FAST  │  RTGS  │  SKN  │  GoPay / OVO (Phase 2)   │
└─────────────────────────────────────────────────────────┘
```

### 8.2 Technology Stack

| Layer | Selection | Notes |
|---|---|---|
| Framework | Astro (all-in approach) | Server-side rendering, API routes, modern DX |
| API | Astro API Routes | RESTful API built into Astro |
| Database | Cloudflare D1 (SQLite) | Edge-located, cost-effective for MVP |
| Queue | D1-backed queue | Webhook delivery using database (no Redis needed) |
| Storage | Cloudflare R2 | Dispute evidence files, S3-compatible API |
| Hosting | Cloudflare Workers/Pages | Edge deployment, generous free tier |
| Email | Cloudflare Email Workers | Buyer/seller notifications |
| Auth | Better Auth | Modern, Cloudflare-compatible auth library |
| Payment | Midtrans | Starting with Midtrans, will add Xendit/DOKU in Phase 2 |

**Implementation Notes:**
- Using D1 instead of PostgreSQL for MVP cost-efficiency and edge performance
- Schema adapted from PostgreSQL to SQLite (UUID → TEXT, JSONB → TEXT, etc.)
- All-in Astro approach simplifies deployment; services can be extracted later if needed
- Better Auth provides session-based auth for dashboards, API key auth for REST API

### 8.3 Key Design Principles

- **Idempotency:** All API mutations accept an `idempotency_key` to prevent double-processing on retries.
- **Event sourcing for ledger:** Every balance change is a ledger event, never an UPDATE. Balance is always derived from the event log.
- **Webhook reliability:** At-least-once delivery with exponential backoff. Sellers must return HTTP 200 to acknowledge.
- **Segregated funds:** Escrow funds must be held in an account separate from Escrow Lite's own operating funds — required for OJK compliance.

---

## 9. Data Model

### 9.1 Sellers

```
sellers
  id                UUID PK
  name              VARCHAR
  email             VARCHAR UNIQUE
  api_key_hash      VARCHAR
  kyc_tier          ENUM(none, basic, full)
  kyc_verified_at   TIMESTAMP
  webhook_url       VARCHAR
  created_at        TIMESTAMP
```

### 9.2 Transactions

```
transactions
  id                UUID PK
  seller_id         UUID FK → sellers
  buyer_email       VARCHAR
  buyer_phone       VARCHAR
  amount            BIGINT (in IDR, integer, no decimals)
  fee_amount        BIGINT
  net_amount        BIGINT (amount - fee_amount)
  status            ENUM(pending, funded, held, released, disputed, refunded, expired)
  gateway           ENUM(midtrans, xendit, doku)
  gateway_ref       VARCHAR (gateway's transaction ID)
  auto_release_at   TIMESTAMP (calculated at funding time)
  absolute_expire_at TIMESTAMP
  shipped_at        TIMESTAMP
  released_at       TIMESTAMP
  release_reason    ENUM(buyer_confirmed, timeout, admin_override)
  metadata          JSONB (seller's own order ID, product info, etc.)
  created_at        TIMESTAMP
  updated_at        TIMESTAMP
```

### 9.3 Ledger

```
ledger_entries
  id                UUID PK
  seller_id         UUID FK → sellers
  transaction_id    UUID FK → transactions (nullable for fee entries)
  type              ENUM(hold, release, fee, payout, refund, adjustment)
  amount            BIGINT (always positive)
  direction         ENUM(credit, debit)
  balance_after     BIGINT (running balance snapshot)
  note              TEXT
  created_at        TIMESTAMP
```

### 9.4 Payouts

```
payouts
  id                UUID PK
  seller_id         UUID FK → sellers
  amount            BIGINT
  bank_code         VARCHAR (e.g., BCA, BRI, MANDIRI)
  account_number    VARCHAR (encrypted)
  account_name      VARCHAR
  status            ENUM(pending, processing, completed, failed)
  disbursement_ref  VARCHAR (gateway disbursement ID)
  failed_reason     TEXT
  requested_at      TIMESTAMP
  completed_at      TIMESTAMP
```

### 9.5 Disputes

```
disputes
  id                UUID PK
  transaction_id    UUID FK → transactions
  initiated_by      ENUM(buyer, seller, admin)
  reason_category   ENUM(not_received, not_as_described, damaged, wrong_item, other)
  buyer_description TEXT
  seller_response   TEXT
  status            ENUM(open, seller_responding, under_review, resolved)
  resolution        ENUM(released_to_seller, refunded_to_buyer, partial)
  resolution_note   TEXT
  admin_id          UUID FK → admins
  resolved_at       TIMESTAMP
  created_at        TIMESTAMP

dispute_evidence
  id                UUID PK
  dispute_id        UUID FK → disputes
  submitted_by      ENUM(buyer, seller)
  file_url          VARCHAR
  file_type         VARCHAR
  uploaded_at       TIMESTAMP
```

---

## 10. API Design

### Authentication

All seller API calls use `Authorization: Bearer {api_key}` where the API key is scoped to one seller account. Keys can be rotated from the dashboard.

### 10.1 Create Transaction

```
POST /v1/transactions

Request:
{
  "idempotency_key": "order-abc-123",
  "buyer_email": "buyer@example.com",
  "buyer_phone": "+6281234567890",
  "amount": 350000,
  "auto_release_days": 3,
  "metadata": {
    "seller_order_id": "ORD-2026-001",
    "product_name": "Kaos Premium M"
  }
}

Response 201:
{
  "id": "txn_xxx",
  "status": "pending",
  "payment_link": "https://pay.escrowlite.id/txn_xxx",
  "expires_at": "2026-03-19T10:00:00Z"
}
```

### 10.2 Payment Gateway Callback (Internal)

```
POST /v1/webhook/gateway/{gateway_name}
  [Receives callback from Midtrans / Xendit / DOKU]
  → Validates signature
  → Transitions transaction: pending → funded → held
  → Sends webhook to seller: transaction.funded
```

### 10.3 Mark as Shipped

```
POST /v1/transactions/{id}/ship

Request:
{
  "tracking_number": "JNE123456",
  "courier": "JNE"
}

Response 200:
{
  "id": "txn_xxx",
  "status": "held",
  "auto_release_at": "2026-03-22T14:00:00Z"
}
```

### 10.4 Buyer Confirms Receipt

```
POST /v1/transactions/{id}/confirm
  [Called via buyer's email link or seller's frontend]
  [No auth required — token embedded in buyer email link]

Response 200:
{
  "id": "txn_xxx",
  "status": "released",
  "released_at": "2026-03-21T09:15:00Z",
  "release_reason": "buyer_confirmed"
}
```

### 10.5 Get Transaction

```
GET /v1/transactions/{id}

Response 200:
{
  "id": "txn_xxx",
  "status": "held",
  "amount": 350000,
  "fee_amount": 3500,
  "net_amount": 346500,
  "auto_release_at": "2026-03-22T14:00:00Z",
  ...
}
```

### 10.6 Request Payout

```
POST /v1/payouts

Request:
{
  "amount": 1000000,
  "bank_account_id": "ba_xxx"
}

Response 201:
{
  "id": "pay_xxx",
  "status": "pending",
  "amount": 1000000,
  "estimated_completion": "2026-03-19T17:00:00Z"
}
```

### 10.7 Webhook Events (Seller receives)

| Event | Trigger |
|---|---|
| `transaction.funded` | Buyer payment confirmed by gateway |
| `transaction.released` | Funds released (any reason) |
| `transaction.disputed` | Buyer opens a dispute |
| `transaction.refunded` | Funds refunded to buyer |
| `payout.completed` | Bank transfer completed |
| `payout.failed` | Bank transfer failed |

Payload structure:
```json
{
  "event": "transaction.released",
  "timestamp": "2026-03-21T09:15:00Z",
  "data": { ...transaction object... }
}
```

---

## 11. Security & Compliance

### 11.1 Security

| Control | Implementation |
|---|---|
| API authentication | SHA-256 hashed API keys, scoped per seller |
| Webhook signature verification | HMAC-SHA256 signature on all outbound webhooks |
| Fund segregation | Escrow funds in dedicated sub-account / virtual account pool |
| Data encryption | PII and bank account numbers encrypted at rest (AES-256) |
| Audit trail | Immutable ledger log; all admin actions logged with actor + reason |
| RBAC | Seller / Admin / Super Admin roles with scoped permissions |
| Rate limiting | Per-key rate limits on all endpoints |
| TLS | TLS 1.3 enforced on all endpoints |

### 11.2 Indonesian Regulatory Considerations

| Area | Notes |
|---|---|
| OJK POJK 77/2016 | Peer-lending regulation — likely not directly applicable, but fund-holding may require fintech registration |
| Bank Indonesia PADG SNAP | Use SNAP-compliant gateway partners to reduce regulatory exposure |
| KYC (Know Your Customer) | Seller onboarding: basic KYC (NIK + selfie) via partner (e.g., Verihubs, Privy) |
| PDPA / UU PDP | Buyer email/phone treated as personal data; consent required; data stored in Indonesia (ap-southeast-3) |
| Fund holding licensing | For Phase 1: operate under existing gateway partner's license; obtain own license in Phase 2 |

### 11.3 Seller KYC Tiers

| Tier | Requirements | Limits |
|---|---|---|
| Unverified | Email only | Max Rp 1,000,000 / transaction; Max Rp 5,000,000 held at once |
| Basic KYC | NIK + phone verified | Max Rp 10,000,000 / transaction; Max Rp 50,000,000 held |
| Full KYC | NIK + selfie + NPWP (for businesses) | Unlimited |

---

## 12. Business Model

### 12.1 Revenue Model

**Transaction fee:** 0.5–1% of escrow amount, collected at release.

| Seller GMV / month | Fee Rate |
|---|---|
| < Rp 10,000,000 | 1.0% |
| Rp 10,000,000 – 50,000,000 | 0.8% |
| > Rp 50,000,000 | 0.5% (negotiated) |

Minimum fee: Rp 1,000 per transaction.

**Payout fee:** Rp 2,500 per bank transfer (cost pass-through).

**Future revenue streams (Phase 2+):**
- Seller verification badge (premium tier, monthly SaaS fee).
- Priority dispute resolution SLA upgrade.
- Analytics dashboard (conversion tracking).
- White-label / API reseller for marketplace operators.

### 12.2 Unit Economics (Estimate)

- Average transaction value: Rp 400,000
- Average fee: 0.8% = Rp 3,200
- Cost per transaction (gateway + infra + support): ~Rp 1,000
- **Gross margin per transaction: ~69%**

---

## 13. Non-Functional Requirements

| Category | Requirement |
|---|---|
| Availability | 99.9% uptime (≤8.7 hours downtime/year) |
| Latency | API p95 < 300ms |
| Payout SLA | Business day payouts completed by 17:00 WIB |
| Webhook delivery | At-least-once, within 60 seconds of event |
| Data retention | Transaction records retained 10 years (regulatory) |
| Scalability | Support 10,000 concurrent held transactions at launch |
| Disaster recovery | RTO < 4 hours, RPO < 1 hour |

---

## 14. Risks & Mitigations

| Risk | Likelihood | Impact | Mitigation |
|---|---|---|---|
| OJK determines fund-holding requires separate license | Medium | High | Partner with licensed e-money issuer; begin licensing process in parallel |
| Seller collects buyer payment outside Escrow Lite to avoid fee | Medium | Medium | Widget only shows as "protected" when Escrow Lite payment link is used; buyer education |
| Fraudulent buyer submits fake dispute | Medium | Medium | Require photo/video evidence; seller can counter; admin decision is binding |
| Payment gateway callback failure (funds paid but not held) | Low | High | Idempotency + reconciliation job; alert on mismatches |
| Payout failure (wrong bank details) | Low | Medium | Verify bank account with Rp 1 penny drop before allowing payouts |
| Competitor (e.g., Xendit Shield, Midtrans Escrow) | Low | High | Move fast; focus on UX and price; build seller community |

---

## 15. Phased Roadmap

### Phase 1 — MVP (Months 1–4)

- [ ] Core escrow engine (hold → release → payout)
- [ ] Midtrans + Xendit gateway integration
- [ ] Seller REST API + webhooks
- [ ] Seller dashboard (basic)
- [ ] Buyer confirmation flow (email link)
- [ ] Auto-release (timeout)
- [ ] Rekber Badge Widget (iframe)
- [ ] Basic dispute submission (no in-app resolution)
- [ ] Admin panel (manual release, dispute review)
- [ ] Basic KYC (phone + NIK via partner)

### Phase 2 — Growth (Months 5–8)

- [ ] Dispute resolution workflow (in-app, with evidence)
- [ ] DOKU + additional gateway integrations
- [ ] Payout to GoPay / OVO / DANA (e-wallet)
- [ ] Seller analytics dashboard
- [ ] WooCommerce plugin
- [ ] Conversion tracking snippet
- [ ] Seller tiered pricing

### Phase 3 — Expansion (Months 9–12)

- [ ] White-label API for marketplace operators
- [ ] Shopify app
- [ ] Mobile-friendly buyer dispute flow
- [ ] AI-assisted dispute evidence review
- [ ] Full KYC + NPWP integration
- [ ] OJK payment institution license application

---

## 16. Open Questions

1. **Licensing path:** Which licensed payment institution partner will hold escrow funds in Phase 1? (Midtrans / Xendit / dedicated trust account?)
2. **Refund mechanism:** How are buyer refunds processed? Does Escrow Lite initiate gateway refunds, or transfer from platform account to buyer's bank? Cost implications?
3. **Dispute SLA for high-value transactions:** Should high-value disputes (>Rp 5,000,000) have a faster SLA or senior admin review by default?
4. **COD handling:** Is escrow on cash-on-delivery transactions in scope? (Likely Phase 2 only, as it requires a different flow.)
5. **Seller identity:** If seller onboards without KYC, what's the liability model if buyer loses money due to seller fraud?
6. **Gateway fee absorption:** Does Escrow Lite absorb the gateway MDR (typically 0.7–1.5%) or pass it through to the seller on top of the escrow fee?

---

## 17. MVP Implementation Addendum (March 2026)

### 17.1 Technology Stack Changes

This MVP implementation updates the technology stack from the original PRD:

**Original → MVP Implementation:**
- PostgreSQL → **Cloudflare D1 (SQLite)**
- AWS Jakarta hosting → **Cloudflare Workers/Pages**
- Node.js/Go API → **Astro API Routes (all-in approach)**
- Redis queue → **D1-backed queue**
- SendGrid/SES → **Cloudflare Email Workers**

**Rationale:**
- **Cost efficiency**: Cloudflare free tier covers MVP needs
- **Simplicity**: Single deployment, faster iteration
- **Edge performance**: D1 provides edge-located database
- **Scalability path**: Services can be extracted to separate Workers later

### 17.2 Implementation Scope

**MVP Includes (Phase 1):**
- ✅ Core escrow engine with state machine
- ✅ Midtrans integration (placeholder credentials)
- ✅ Seller REST API with API key authentication
- ✅ Seller dashboard (transactions, balance, payouts)
- ✅ Buyer confirmation flow (email link)
- ✅ Auto-release on timeout
- ✅ Admin panel (manual release, dispute review)
- ✅ Three-tier KYC system (with provider interfaces)
- ✅ Badge widget (iframe + JS snippet)
- ✅ Webhook delivery system
- ✅ Payout request system
- ✅ Basic dispute submission
- ✅ Immutable ledger
- ✅ Comprehensive testing

**Phase 2 (Future):**
- Additional payment gateways (Xendit, DOKU)
- E-wallet payouts (GoPay, OVO, DANA)
- WooCommerce/Shopify plugins
- Conversion analytics
- Tiered pricing

**Phase 3 (Future):**
- White-label API
- AI-assisted dispute review
- Full OJK licensing

### 17.3 Data Model Adaptations

**PostgreSQL → D1/SQLite adaptations:**
- `UUID` → `TEXT` (generated in application)
- `BIGINT` → `INTEGER`
- `ENUM` → `TEXT` with `CHECK` constraints
- `JSONB` → `TEXT` (JSON stored as string)
- `TIMESTAMP` → `TEXT` (ISO 8601 format)

**Key implications:**
- UUID generation happens in application code
- Enum validation moved to database constraints
- JSON fields parsed on read, stringified on write
- All timestamps as ISO 8601 strings

### 17.4 Security Architecture

**API Authentication:**
- Dashboard: Better Auth (session-based cookies)
- REST API: Bearer token with SHA-256 hashed keys
- Admin: Better Auth with role-based access control

**Data Protection:**
- AES-256-GCM encryption for bank accounts
- HMAC-SHA256 for webhook signatures
- PII anonymization in logs
- Segregated fund tracking via immutable ledger

**Compliance:**
- KYC tiers with transaction limits
- Audit trail for all admin actions
- Data stored in Indonesia (Cloudflare SIN)
- PDPA compliant data handling

### 17.5 Open Questions Resolved

From Section 16, the following are resolved for MVP:

1. **Licensing path**: Using Midtrans partner license for Phase 1; OJK application planned for Phase 3
2. **Refund mechanism**: Gateway refunds initiated by Escrow Lite; costs passed to seller
3. **Dispute SLA**: Standard 5-day SLA for all disputes; can prioritize high-value in Phase 2
4. **COD handling**: Out of scope for MVP; Phase 2 consideration
5. **Seller liability**: Terms of service clarify escrow doesn't guarantee seller solvency
6. **Gateway fees**: Passed through to seller (transparent in transaction details)

### 17.6 Development Timeline

**10-week implementation plan:**
- Week 1-2: Foundation (project setup, database, auth)
- Week 3: Escrow engine & state machine
- Week 4: Midtrans integration & buyer flow
- Week 5: Seller dashboard
- Week 6: Admin panel
- Week 7: Payout system
- Week 8: Dispute system
- Week 9: Badge widget
- Week 10: Testing, documentation, polish

### 17.7 Success Criteria

**MVP Success Definition:**
- 5 test sellers onboarded
- 100+ test transactions processed end-to-end
- All critical flows tested (payment, hold, release, dispute, payout)
- <1% error rate
- Security audit passed
- API documentation complete
- Integration guide available

**Phase 1 Complete When:**
- All P0 features from Section 5.1 implemented
- Test coverage ≥80%
- Performance benchmarks met (p95 < 300ms)
- Production deployed on Cloudflare Workers

---

*End of Document*
