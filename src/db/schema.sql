-- Escrow Lite MVP Database Schema
-- D1/SQLite compatible
-- All UUIDs are stored as TEXT (generated in application)
-- All timestamps are ISO 8601 strings (TEXT)
-- All amounts are in IDR (INTEGER, no decimals)

-- =====================================================
-- SELLERS & AUTHENTICATION
-- =====================================================

CREATE TABLE sellers (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    email TEXT NOT NULL UNIQUE,
    api_key_hash TEXT NOT NULL UNIQUE,
    kyc_tier TEXT NOT NULL DEFAULT 'none' CHECK(kyc_tier IN ('none', 'basic', 'full')),
    kyc_verified_at TEXT,
    webhook_url TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE api_keys (
    id TEXT PRIMARY KEY,
    seller_id TEXT NOT NULL,
    key_hash TEXT NOT NULL UNIQUE,
    name TEXT NOT NULL,
    scopes TEXT NOT NULL DEFAULT '["read", "write"]',
    last_used_at TEXT,
    expires_at TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    revoked_at TEXT,
    FOREIGN KEY (seller_id) REFERENCES sellers(id) ON DELETE CASCADE
);

CREATE TABLE seller_bank_accounts (
    id TEXT PRIMARY KEY,
    seller_id TEXT NOT NULL,
    bank_code TEXT NOT NULL, -- BCA, BRI, MANDIRI, etc.
    account_number TEXT NOT NULL, -- encrypted
    account_name TEXT NOT NULL,
    is_primary INTEGER NOT NULL DEFAULT 0,
    verified_at TEXT, -- timestamp of penny-drop verification
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now')),
    FOREIGN KEY (seller_id) REFERENCES sellers(id) ON DELETE CASCADE
);

-- =====================================================
-- TRANSACTIONS
-- =====================================================

CREATE TABLE transactions (
    id TEXT PRIMARY KEY,
    seller_id TEXT NOT NULL,
    buyer_email TEXT NOT NULL,
    buyer_phone TEXT,
    amount INTEGER NOT NULL, -- in IDR, no decimals
    fee_amount INTEGER NOT NULL DEFAULT 0, -- in IDR
    fee_rate INTEGER NOT NULL DEFAULT 100, -- basis points (100 = 1%)
    net_amount INTEGER NOT NULL, -- amount - fee_amount
    status TEXT NOT NULL DEFAULT 'pending' CHECK(status IN (
        'pending', 'funded', 'held', 'released', 'disputed', 'refunded', 'expired'
    )),
    gateway TEXT CHECK(gateway IN ('midtrans', 'xendit', 'doku')),
    gateway_ref TEXT, -- gateway's transaction ID
    payment_method TEXT, -- va, qris, ewallet, etc.
    payment_link TEXT, -- buyer-facing payment URL
    auto_release_days INTEGER NOT NULL DEFAULT 3,
    auto_release_at TEXT,
    absolute_expire_at TEXT NOT NULL,
    shipped_at TEXT,
    tracking_number TEXT,
    courier TEXT,
    released_at TEXT,
    release_reason TEXT CHECK(release_reason IN (
        'buyer_confirmed', 'timeout', 'admin_override'
    )),
    refunded_at TEXT,
    refund_reason TEXT,
    idempotency_key TEXT UNIQUE,
    metadata TEXT, -- JSON string
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now')),
    FOREIGN KEY (seller_id) REFERENCES sellers(id) ON DELETE RESTRICT
);

-- =====================================================
-- LEDGER (Immutable double-entry bookkeeping)
-- =====================================================

CREATE TABLE ledger_entries (
    id TEXT PRIMARY KEY,
    seller_id TEXT NOT NULL,
    transaction_id TEXT, -- nullable for fee entries, payouts, adjustments
    payout_id TEXT, -- nullable
    type TEXT NOT NULL CHECK(type IN (
        'hold', 'release', 'fee', 'payout', 'refund', 'adjustment'
    )),
    amount INTEGER NOT NULL, -- always positive
    direction TEXT NOT NULL CHECK(direction IN ('credit', 'debit')),
    balance_after INTEGER NOT NULL, -- running balance snapshot
    note TEXT,
    metadata TEXT, -- JSON string for additional context
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    FOREIGN KEY (seller_id) REFERENCES sellers(id) ON DELETE CASCADE,
    FOREIGN KEY (transaction_id) REFERENCES transactions(id) ON DELETE SET NULL,
    FOREIGN KEY (payout_id) REFERENCES payouts(id) ON DELETE SET NULL
);

-- =====================================================
-- PAYOUTS
-- =====================================================

CREATE TABLE payouts (
    id TEXT PRIMARY KEY,
    seller_id TEXT NOT NULL,
    amount INTEGER NOT NULL,
    fee_amount INTEGER NOT NULL DEFAULT 2500, -- Rp 2,500 per payout
    net_amount INTEGER NOT NULL, -- amount - fee_amount
    bank_account_id TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'pending' CHECK(status IN (
        'pending', 'processing', 'completed', 'failed', 'cancelled'
    )),
    disbursement_ref TEXT, -- gateway disbursement ID
    gateway TEXT CHECK(gateway IN ('midtrans', 'xendit', 'doku')),
    failed_reason TEXT,
    requested_at TEXT NOT NULL DEFAULT (datetime('now')),
    processing_at TEXT,
    completed_at TEXT,
    metadata TEXT, -- JSON string
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now')),
    FOREIGN KEY (seller_id) REFERENCES sellers(id) ON DELETE RESTRICT,
    FOREIGN KEY (bank_account_id) REFERENCES seller_bank_accounts(id)
);

-- =====================================================
-- DISPUTES
-- =====================================================

CREATE TABLE disputes (
    id TEXT PRIMARY KEY,
    transaction_id TEXT NOT NULL,
    initiated_by TEXT NOT NULL CHECK(initiated_by IN ('buyer', 'seller', 'admin')),
    reason_category TEXT NOT NULL CHECK(reason_category IN (
        'not_received', 'not_as_described', 'damaged', 'wrong_item', 'other'
    )),
    buyer_description TEXT,
    seller_response TEXT,
    status TEXT NOT NULL DEFAULT 'open' CHECK(status IN (
        'open', 'seller_responding', 'under_review', 'resolved', 'closed'
    )),
    resolution TEXT CHECK(resolution IN (
        'released_to_seller', 'refunded_to_buyer', 'partial', 'rejected'
    )),
    resolution_note TEXT,
    admin_id TEXT,
    resolved_at TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now')),
    FOREIGN KEY (transaction_id) REFERENCES transactions(id) ON DELETE CASCADE,
    FOREIGN KEY (admin_id) REFERENCES admin_users(id)
);

CREATE TABLE dispute_evidence (
    id TEXT PRIMARY KEY,
    dispute_id TEXT NOT NULL,
    submitted_by TEXT NOT NULL CHECK(submitted_by IN ('buyer', 'seller')),
    file_url TEXT NOT NULL,
    file_type TEXT NOT NULL, -- image, video, document
    file_name TEXT,
    file_size INTEGER, -- in bytes
    description TEXT,
    uploaded_at TEXT NOT NULL DEFAULT (datetime('now')),
    FOREIGN KEY (dispute_id) REFERENCES disputes(id) ON DELETE CASCADE
);

-- =====================================================
-- WEBHOOK DELIVERY LOG
-- =====================================================

CREATE TABLE webhook_delivery_log (
    id TEXT PRIMARY KEY,
    seller_id TEXT NOT NULL,
    event_type TEXT NOT NULL, -- transaction.funded, transaction.released, etc.
    transaction_id TEXT,
    payout_id TEXT,
    dispute_id TEXT,
    payload TEXT NOT NULL, -- JSON string
    target_url TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'pending' CHECK(status IN (
        'pending', 'delivered', 'failed', 'retrying'
    )),
    http_status_code INTEGER,
    response_body TEXT,
    attempt_count INTEGER NOT NULL DEFAULT 0,
    next_retry_at TEXT,
    delivered_at TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    FOREIGN KEY (seller_id) REFERENCES sellers(id) ON DELETE CASCADE,
    FOREIGN KEY (transaction_id) REFERENCES transactions(id) ON DELETE SET NULL,
    FOREIGN KEY (payout_id) REFERENCES payouts(id) ON DELETE SET NULL,
    FOREIGN KEY (dispute_id) REFERENCES disputes(id) ON DELETE SET NULL
);

-- =====================================================
-- CONFIRMATION TOKENS (for buyer email links)
-- =====================================================

CREATE TABLE confirmation_tokens (
    id TEXT PRIMARY KEY,
    transaction_id TEXT NOT NULL UNIQUE,
    token TEXT NOT NULL UNIQUE,
    buyer_email TEXT NOT NULL,
    expires_at TEXT NOT NULL,
    used_at TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    FOREIGN KEY (transaction_id) REFERENCES transactions(id) ON DELETE CASCADE
);

-- =====================================================
-- ADMIN USERS
-- =====================================================

CREATE TABLE admin_users (
    id TEXT PRIMARY KEY,
    email TEXT NOT NULL UNIQUE,
    name TEXT NOT NULL,
    role TEXT NOT NULL DEFAULT 'admin' CHECK(role IN ('admin', 'super_admin')),
    password_hash TEXT NOT NULL,
    is_active INTEGER NOT NULL DEFAULT 1,
    last_login_at TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- =====================================================
-- AUDIT LOG
-- =====================================================

CREATE TABLE audit_log (
    id TEXT PRIMARY KEY,
    actor_type TEXT NOT NULL CHECK(actor_type IN ('seller', 'admin', 'system')),
    actor_id TEXT,
    action TEXT NOT NULL, -- transaction.release, dispute.resolve, etc.
    target_type TEXT NOT NULL, -- transaction, dispute, seller, etc.
    target_id TEXT NOT NULL,
    old_values TEXT, -- JSON string of previous state
    new_values TEXT, -- JSON string of new state
    reason TEXT,
    ip_address TEXT,
    user_agent TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- =====================================================
-- SCHEMA MIGRATIONS
-- =====================================================

CREATE TABLE schema_migrations (
    version INTEGER PRIMARY KEY,
    name TEXT NOT NULL,
    applied_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- =====================================================
-- INDEXES
-- =====================================================

-- Sellers
CREATE INDEX idx_sellers_email ON sellers(email);
CREATE INDEX idx_sellers_kyc_tier ON sellers(kyc_tier);

-- API Keys
CREATE INDEX idx_api_keys_seller_id ON api_keys(seller_id);
CREATE INDEX idx_api_keys_key_hash ON api_keys(key_hash);

-- Seller Bank Accounts
CREATE INDEX idx_seller_bank_accounts_seller_id ON seller_bank_accounts(seller_id);
CREATE INDEX idx_seller_bank_accounts_bank_code ON seller_bank_accounts(bank_code);

-- Transactions
CREATE INDEX idx_transactions_seller_id ON transactions(seller_id);
CREATE INDEX idx_transactions_status ON transactions(status);
CREATE INDEX idx_transactions_gateway_ref ON transactions(gateway_ref);
CREATE INDEX idx_transactions_idempotency_key ON transactions(idempotency_key);
CREATE INDEX idx_transactions_created_at ON transactions(created_at);
CREATE INDEX idx_transactions_auto_release_at ON transactions(auto_release_at);
CREATE INDEX idx_transactions_absolute_expire_at ON transactions(absolute_expire_at);

-- Ledger Entries
CREATE INDEX idx_ledger_entries_seller_id ON ledger_entries(seller_id);
CREATE INDEX idx_ledger_entries_transaction_id ON ledger_entries(transaction_id);
CREATE INDEX idx_ledger_entries_payout_id ON ledger_entries(payout_id);
CREATE INDEX idx_ledger_entries_created_at ON ledger_entries(created_at);

-- Payouts
CREATE INDEX idx_payouts_seller_id ON payouts(seller_id);
CREATE INDEX idx_payouts_status ON payouts(status);
CREATE INDEX idx_payouts_bank_account_id ON payouts(bank_account_id);
CREATE INDEX idx_payouts_created_at ON payouts(created_at);

-- Disputes
CREATE INDEX idx_disputes_transaction_id ON disputes(transaction_id);
CREATE INDEX idx_disputes_status ON disputes(status);
CREATE INDEX idx_disputes_admin_id ON disputes(admin_id);
CREATE INDEX idx_disputes_created_at ON disputes(created_at);

-- Dispute Evidence
CREATE INDEX idx_dispute_evidence_dispute_id ON dispute_evidence(dispute_id);

-- Webhook Delivery Log
CREATE INDEX idx_webhook_delivery_log_seller_id ON webhook_delivery_log(seller_id);
CREATE INDEX idx_webhook_delivery_log_status ON webhook_delivery_log(status);
CREATE INDEX idx_webhook_delivery_log_event_type ON webhook_delivery_log(event_type);
CREATE INDEX idx_webhook_delivery_log_next_retry_at ON webhook_delivery_log(next_retry_at);

-- Confirmation Tokens
CREATE INDEX idx_confirmation_tokens_transaction_id ON confirmation_tokens(transaction_id);
CREATE INDEX idx_confirmation_tokens_token ON confirmation_tokens(token);
CREATE INDEX idx_confirmation_tokens_expires_at ON confirmation_tokens(expires_at);

-- Admin Users
CREATE INDEX idx_admin_users_email ON admin_users(email);
CREATE INDEX idx_admin_users_role ON admin_users(role);

-- Audit Log
CREATE INDEX idx_audit_log_actor ON audit_log(actor_type, actor_id);
CREATE INDEX idx_audit_log_target ON audit_log(target_type, target_id);
CREATE INDEX idx_audit_log_created_at ON audit_log(created_at);
CREATE INDEX idx_audit_log_action ON audit_log(action);

-- =====================================================
-- TRIGGERS
-- =====================================================

-- Update updated_at timestamp for sellers
CREATE TRIGGER update_sellers_updated_at
    AFTER UPDATE ON sellers
    FOR EACH ROW
    BEGIN
        UPDATE sellers SET updated_at = datetime('now') WHERE id = NEW.id;
    END;

-- Update updated_at timestamp for seller_bank_accounts
CREATE TRIGGER update_seller_bank_accounts_updated_at
    AFTER UPDATE ON seller_bank_accounts
    FOR EACH ROW
    BEGIN
        UPDATE seller_bank_accounts SET updated_at = datetime('now') WHERE id = NEW.id;
    END;

-- Update updated_at timestamp for transactions
CREATE TRIGGER update_transactions_updated_at
    AFTER UPDATE ON transactions
    FOR EACH ROW
    BEGIN
        UPDATE transactions SET updated_at = datetime('now') WHERE id = NEW.id;
    END;

-- Update updated_at timestamp for payouts
CREATE TRIGGER update_payouts_updated_at
    AFTER UPDATE ON payouts
    FOR EACH ROW
    BEGIN
        UPDATE payouts SET updated_at = datetime('now') WHERE id = NEW.id;
    END;

-- Update updated_at timestamp for disputes
CREATE TRIGGER update_disputes_updated_at
    AFTER UPDATE ON disputes
    FOR EACH ROW
    BEGIN
        UPDATE disputes SET updated_at = datetime('now') WHERE id = NEW.id;
    END;

-- Update updated_at timestamp for admin_users
CREATE TRIGGER update_admin_users_updated_at
    AFTER UPDATE ON admin_users
    FOR EACH ROW
    BEGIN
        UPDATE admin_users SET updated_at = datetime('now') WHERE id = NEW.id;
    END;

-- =====================================================
-- VIEWS
-- =====================================================

-- Seller balance summary (current balance from latest ledger entry)
CREATE VIEW v_seller_balances AS
SELECT
    s.id AS seller_id,
    s.name AS seller_name,
    s.email AS seller_email,
    s.kyc_tier,
    COALESCE(
        (SELECT balance_after FROM ledger_entries le
         WHERE le.seller_id = s.id
         ORDER BY le.created_at DESC
         LIMIT 1),
        0
    ) AS current_balance,
    COALESCE(
        (SELECT COUNT(*) FROM transactions t
         WHERE t.seller_id = s.id AND t.status IN ('held', 'disputed')),
        0
    ) AS active_holds,
    COALESCE(
        (SELECT SUM(t.amount) FROM transactions t
         WHERE t.seller_id = s.id AND t.status IN ('held', 'disputed')),
        0
    ) AS total_held_amount
FROM sellers s;

-- Transaction summary with seller and dispute info
CREATE VIEW v_transaction_details AS
SELECT
    t.id,
    t.seller_id,
    s.name AS seller_name,
    s.email AS seller_email,
    t.buyer_email,
    t.amount,
    t.fee_amount,
    t.net_amount,
    t.status,
    t.gateway,
    t.gateway_ref,
    t.auto_release_at,
    t.shipped_at,
    t.released_at,
    t.release_reason,
    t.created_at,
    d.id AS dispute_id,
    d.status AS dispute_status,
    d.reason_category AS dispute_reason
FROM transactions t
LEFT JOIN sellers s ON t.seller_id = s.id
LEFT JOIN disputes d ON t.id = d.transaction_id;

-- Payout summary with bank details
CREATE VIEW v_payout_details AS
SELECT
    p.id,
    p.seller_id,
    s.name AS seller_name,
    s.email AS seller_email,
    p.amount,
    p.fee_amount,
    p.net_amount,
    p.status,
    ba.bank_code,
    '****' || SUBSTR(ba.account_number, -4) AS masked_account_number,
    ba.account_name,
    p.requested_at,
    p.completed_at
FROM payouts p
JOIN sellers s ON p.seller_id = s.id
JOIN seller_bank_accounts ba ON p.bank_account_id = ba.id;
