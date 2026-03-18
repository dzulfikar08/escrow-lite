# cURL Examples

Collection of cURL examples for common Escrow Lite API operations.

## Authentication

### Register

```bash
curl -X POST https://api.escrow-lite.id/api/v1/auth/register \
  -H "Content-Type: application/json" \
  -d '{
    "email": "seller@example.com",
    "password": "SecurePass123!",
    "name": "John Doe"
  }'
```

### Login

```bash
curl -X POST https://api.escrow-lite.id/api/v1/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "seller@example.com",
    "password": "SecurePass123!"
  }' \
  -c cookies.txt
```

### Logout

```bash
curl -X POST https://api.escrow-lite.id/api/v1/auth/logout \
  -b cookies.txt
```

## Transactions

### Create Transaction

```bash
curl -X POST https://api.escrow-lite.id/api/v1/transactions \
  -H "Content-Type: application/json" \
  -b cookies.txt \
  -d '{
    "buyer_email": "buyer@example.com",
    "buyer_phone": "+628123456789",
    "amount": 150000,
    "auto_release_days": 3,
    "metadata": {
      "order_id": "ORD-12345",
      "items": "Bluetooth Headphones"
    }
  }'
```

### Get Transaction

```bash
curl https://api.escrow-lite.id/api/v1/transactions/tx_abc123 \
  -b cookies.txt
```

### List Transactions

```bash
curl "https://api.escrow-lite.id/api/v1/seller/transactions?page=1&limit=20" \
  -b cookies.txt
```

### List Transactions (Filtered)

```bash
# By status
curl "https://api.escrow-lite.id/api/v1/seller/transactions?status=held" \
  -b cookies.txt

# Search
curl "https://api.escrow-lite.id/api/v1/seller/transactions?search=john" \
  -b cookies.txt
```

### Mark as Shipped

```bash
curl -X POST https://api.escrow-lite.id/api/v1/transactions/tx_abc123/ship \
  -H "Content-Type: application/json" \
  -b cookies.txt \
  -d '{
    "tracking_number": "JNE123456789"
  }'
```

### Buyer Confirm Receipt

```bash
curl -X POST https://api.escrow-lite.id/api/v1/transactions/tx_abc123/confirm \
  -b cookies.txt
```

## Balance

### Get Balance

```bash
curl https://api.escrow-lite.id/api/v1/seller/balance \
  -b cookies.txt
```

## Payouts

### Request Payout

```bash
curl -X POST https://api.escrow-lite.id/api/v1/payouts \
  -H "Content-Type: application/json" \
  -b cookies.txt \
  -d '{
    "amount": 150000,
    "bank_account_id": "ba_abc123"
  }'
```

### List Payouts

```bash
curl "https://api.escrow-lite.id/api/v1/payouts?page=1&limit=20" \
  -b cookies.txt
```

### List Payouts (Filtered)

```bash
curl "https://api.escrow-lite.id/api/v1/payouts?status=completed" \
  -b cookies.txt
```

## Bank Accounts

### List Bank Accounts

```bash
curl https://api.escrow-lite.id/api/v1/bank-accounts \
  -b cookies.txt
```

### Add Bank Account

```bash
curl -X POST https://api.escrow-lite.id/api/v1/bank-accounts \
  -H "Content-Type: application/json" \
  -b cookies.txt \
  -d '{
    "bank_name": "BCA",
    "account_number": "1234567890",
    "account_holder_name": "JOHN DOE"
  }'
```

### Set Primary Bank Account

```bash
curl -X PUT https://api.escrow-lite.id/api/v1/bank-accounts/ba_abc123/primary \
  -b cookies.txt
```

### Delete Bank Account

```bash
curl -X DELETE https://api.escrow-lite.id/api/v1/bank-accounts/ba_abc123 \
  -b cookies.txt
```

## Disputes

### List Disputes

```bash
curl "https://api.escrow-lite.id/api/v1/disputes?page=1&limit=20" \
  -b cookies.txt
```

### Open Dispute

```bash
curl -X POST https://api.escrow-lite.id/api/v1/disputes \
  -H "Content-Type: application/json" \
  -b cookies.txt \
  -d '{
    "transaction_id": "tx_abc123",
    "reason": "Item not as described"
  }'
```

### Respond to Dispute

```bash
curl -X POST https://api.escrow-lite.id/api/v1/disputes/dsp_abc123/respond \
  -H "Content-Type: application/json" \
  -b cookies.txt \
  -d '{
    "response": "Item shipped correctly, see tracking evidence"
  }'
```

### Upload Evidence

```bash
curl -X POST https://api.escrow-lite.id/api/v1/disputes/dsp_abc123/evidence \
  -b cookies.txt \
  -F "file=@/path/to/evidence.jpg" \
  -F "description=Photo of item condition"
```

## Health & Monitoring

### Health Check

```bash
curl https://api.escrow-lite.id/health
```

### Detailed Health

```bash
curl https://api.escrow-lite.id/health/detailed
```

### Metrics

```bash
curl https://api.escrow-lite.id/health/metrics
```

### Badge Stats (Public)

```bash
curl https://api.escrow-lite.id/api/badge/seller_abc123/stats
```

## Tips

### Save and Reuse Cookies

```bash
# Save cookies to file on login
curl -X POST https://api.escrow-lite.id/api/v1/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email": "...", "password": "..."}' \
  -c cookies.txt

# Use cookies in subsequent requests
curl https://api.escrow-lite.id/api/v1/seller/transactions \
  -b cookies.txt
```

### Pretty Print JSON

```bash
curl https://api.escrow-lite.id/api/v1/transactions/tx_abc123 \
  -b cookies.txt | jq
```

### Verbose Output (for debugging)

```bash
curl -v https://api.escrow-lite.id/health
```

### Include Request Headers in Response

```bash
curl -i https://api.escrow-lite.id/health
```

### Follow Redirects

```bash
curl -L https://api.escrow-lite.id/health
```

## Environment Variables

Set these to simplify commands:

```bash
# Add to ~/.bashrc or ~/.zshrc
export ESCROW_API="https://api.escrow-lite.id"
export ESCROW_SESSION="cookies.txt"

# Usage
curl $ESCROW_API/health
curl $ESCROW_API/api/v1/seller/transactions -b $ESCROW_SESSION
```
