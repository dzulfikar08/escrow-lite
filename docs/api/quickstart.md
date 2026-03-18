# Quick Start Guide

Get started with the Escrow Lite API in 5 minutes.

## Prerequisites

- Valid email address
- Indonesian bank account (for payouts)
- Basic knowledge of REST APIs

## Step 1: Register an Account

```bash
curl -X POST https://api.escrow-lite.id/api/v1/auth/register \
  -H "Content-Type: application/json" \
  -d '{
    "email": "seller@example.com",
    "password": "SecurePass123!",
    "name": "Your Store Name"
  }'
```

**Response:**

```json
{
  "data": {
    "id": "user_abc123",
    "email": "seller@example.com",
    "name": "Your Store Name",
    "kyc_tier": "none",
    "created_at": "2024-01-15T10:00:00Z"
  },
  "meta": {
    "request_id": "req_xyz789",
    "timestamp": "2024-01-15T10:00:00Z"
  }
}
```

Save the session cookie from the `Set-Cookie` header.

## Step 2: Create Your First Transaction

```bash
curl -X POST https://api.escrow-lite.id/api/v1/transactions \
  -H "Content-Type: application/json" \
  -H "Cookie: session=YOUR_SESSION_COOKIE" \
  -d '{
    "buyer_email": "buyer@example.com",
    "buyer_phone": "+628123456789",
    "amount": 150000,
    "auto_release_days": 3,
    "metadata": {
      "order_id": "ORD-12345",
      "items": "Wireless Bluetooth Headphones"
    }
  }'
```

**Response:**

```json
{
  "data": {
    "id": "tx_abc123",
    "seller_id": "user_abc123",
    "buyer_email": "buyer@example.com",
    "buyer_phone": "+628123456789",
    "amount": 150000,
    "fee_rate": 0.01,
    "fee_amount": 1500,
    "net_amount": 148500,
    "gateway": "midtrans",
    "status": "pending",
    "auto_release_days": 3,
    "auto_release_at": "2024-01-21T10:00:00Z",
    "absolute_expire_at": "2024-01-29T10:00:00Z",
    "created_at": "2024-01-15T10:05:00Z",
    "updated_at": "2024-01-15T10:05:00Z"
  },
  "meta": {
    "request_id": "req_def456",
    "timestamp": "2024-01-15T10:05:00Z"
  }
}
```

### What Just Happened?

1. **Fee Calculation:** Escrow Lite calculated a 1% fee (Rp 1,500)
2. **Net Amount:** Your net amount is Rp 148,500 (Rp 150,000 - Rp 1,500)
3. **Auto-Release:** Funds auto-release in 3 days if buyer confirms
4. **Absolute Expiry:** Transaction expires in 14 days if unresolved

## Step 3: Redirect Buyer to Payment

Use the `payment_url` from the response (not shown above, but included in full response) to redirect the buyer:

```html
<a href="https://api.escrow-lite.id/payments/tx_abc123">
  Complete Payment
</a>
```

The buyer will be redirected to Midtrans to complete payment.

## Step 4: Wait for Payment Confirmation

Midtrans sends a webhook to Escrow Lite when payment is complete. The transaction status changes to `funded`, then `held`.

**Check Transaction Status:**

```bash
curl https://api.escrow-lite.id/api/v1/transactions/tx_abc123 \
  -H "Cookie: session=YOUR_SESSION_COOKIE"
```

When status is `held`, you can ship the item.

## Step 5: Mark as Shipped

```bash
curl -X POST https://api.escrow-lite.id/api/v1/transactions/tx_abc123/ship \
  -H "Content-Type: application/json" \
  -H "Cookie: session=YOUR_SESSION_COOKIE" \
  -d '{
    "tracking_number": "JNE123456789"
  }'
```

This starts the auto-release countdown.

## Step 6: Buyer Confirms Receipt

The buyer receives an email with a confirmation link. When they click it, funds are released to your available balance.

## Step 7: Request Payout

Once funds are in your **available balance**, request a payout:

```bash
curl -X POST https://api.escrow-lite.id/api/v1/payouts \
  -H "Content-Type: application/json" \
  -H "Cookie: session=YOUR_SESSION_COOKIE" \
  -d '{
    "amount": 148500,
    "bank_account_id": "ba_xyz789"
  }'
```

Payouts are processed within 1-2 business days.

## Common Workflows

### Creating Multiple Transactions

```javascript
const transactions = [
  {
    buyer_email: 'buyer1@example.com',
    buyer_phone: '+628123456789',
    amount: 250000,
    metadata: { order_id: 'ORD-001' }
  },
  {
    buyer_email: 'buyer2@example.com',
    buyer_phone: '+628123456789',
    amount: 175000,
    metadata: { order_id: 'ORD-002' }
  }
];

for (const tx of transactions) {
  const response = await fetch('https://api.escrow-lite.id/api/v1/transactions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Cookie': `session=${sessionToken}`
    },
    body: JSON.stringify(tx)
  });

  const data = await response.json();
  console.log('Created transaction:', data.data.id);
}
```

### Listing Transactions

```bash
# Get first page of transactions
curl "https://api.escrow-lite.id/api/v1/seller/transactions?page=1&limit=20" \
  -H "Cookie: session=YOUR_SESSION_COOKIE"
```

**Response:**

```json
{
  "data": {
    "transactions": [
      {
        "id": "tx_abc123",
        "status": "held",
        "amount": 150000,
        "buyer_email": "buyer@example.com",
        "created_at": "2024-01-15T10:00:00Z"
      }
    ],
    "total": 42,
    "page": 1,
    "limit": 20
  },
  "meta": {
    "request_id": "req_ghi789",
    "timestamp": "2024-01-15T11:00:00Z"
  }
}
```

### Filtering by Status

```bash
curl "https://api.escrow-lite.id/api/v1/seller/transactions?status=held" \
  -H "Cookie: session=YOUR_SESSION_COOKIE"
```

### Searching Transactions

```bash
curl "https://api.escrow-lite.id/api/v1/seller/transactions?search=john" \
  -H "Cookie: session=YOUR_SESSION_COOKIE"
```

Searches in buyer email and phone number.

## Testing Sandbox

For testing without real money, use the sandbox environment:

```bash
# Use sandbox base URL
export BASE_URL="https://sandbox.escrow-lite.id"

# All endpoints work the same
curl -X POST ${BASE_URL}/api/v1/auth/register \
  -H "Content-Type: application/json" \
  -d '{ ... }'
```

Sandbox features:
- No real money involved
- Test payment cards work
- Instant auto-release (30 seconds instead of 3 days)
- Resets daily

## Next Steps

1. **Add Bank Account** - Enable payouts
2. **Upgrade KYC Tier** - Increase transaction limits
3. **Setup Webhooks** - Receive real-time notifications
4. **Integrate Badge Widget** - Build trust with buyers
5. **Read Full API Reference** - Explore all endpoints

## Need Help?

- **Documentation:** [docs.escrow-lite.id](https://docs.escrow-lite.id)
- **Support Email:** support@escrow-lite.id
- **Status Page:** [status.escrow-lite.id](https://status.escrow-lite.id)
- **GitHub:** [github.com/escrow-lite/api](https://github.com/escrow-lite/api)
