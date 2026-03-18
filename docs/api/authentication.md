# Authentication Guide

This guide explains how to authenticate with the Escrow Lite API.

## Overview

Escrow Lite API uses **Bearer token authentication** based on session cookies. When you log in, the API returns a session cookie that you must include with subsequent requests.

## Authentication Flow

### 1. Register a New Account

```bash
curl -X POST https://api.escrow-lite.id/api/v1/auth/register \
  -H "Content-Type: application/json" \
  -d '{
    "email": "seller@example.com",
    "password": "SecurePass123!",
    "name": "John Doe"
  }'
```

**Response (201 Created):**

```json
{
  "data": {
    "id": "user_123abc",
    "email": "seller@example.com",
    "name": "John Doe",
    "kyc_tier": "none",
    "created_at": "2024-01-15T10:30:00Z"
  },
  "meta": {
    "request_id": "req_abc123",
    "timestamp": "2024-01-15T10:30:00Z"
  }
}
```

The response includes a `Set-Cookie` header with the session token.

### 2. Login

```bash
curl -X POST https://api.escrow-lite.id/api/v1/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "seller@example.com",
    "password": "SecurePass123!"
  }'
```

**Response (200 OK):**

```json
{
  "data": {
    "id": "user_123abc",
    "email": "seller@example.com",
    "name": "John Doe",
    "kyc_tier": "none"
  },
  "meta": {
    "request_id": "req_xyz789",
    "timestamp": "2024-01-15T10:35:00Z"
  }
}
```

The response includes a `Set-Cookie` header with the session token.

### 3. Use Session Cookie in Subsequent Requests

```bash
curl https://api.escrow-lite.id/api/v1/seller/transactions \
  -H "Cookie: session=YOUR_SESSION_TOKEN"
```

## Using Authorization Header

Alternatively, you can use the `Authorization` header with Bearer token:

```bash
curl https://api.escrow-lite.id/api/v1/seller/transactions \
  -H "Authorization: Bearer YOUR_SESSION_TOKEN"
```

## Session Management

### Session Expiration

- Sessions expire after **7 days** of inactivity
- You can extend a session by making API calls
- After expiration, you need to log in again

### Logout

```bash
curl -X POST https://api.escrow-lite.id/api/v1/auth/logout \
  -H "Cookie: session=YOUR_SESSION_TOKEN"
```

This clears the session cookie and invalidates the token.

## SDKs and Libraries

### JavaScript/TypeScript

```typescript
import { EscrowLiteClient } from '@escrow-lite/sdk';

const client = new EscrowLiteClient({
  baseURL: 'https://api.escrow-lite.id',
  email: 'seller@example.com',
  password: 'SecurePass123!'
});

// Login and store session
await client.auth.login();

// Make authenticated requests
const transactions = await client.transactions.list();
```

### Python

```python
from escrow_lite import EscrowLiteClient

client = EscrowLiteClient(
    base_url='https://api.escrow-lite.id',
    email='seller@example.com',
    password='SecurePass123!'
)

# Login
client.auth.login()

# Make authenticated requests
transactions = client.transactions.list()
```

## Rate Limiting

The API implements rate limiting to ensure fair usage:

- **Standard endpoints:** 100 requests per minute
- **Webhook endpoints:** 1000 requests per minute

When rate limit is exceeded, you'll receive a `429 Too Many Requests` response:

```json
{
  "error": "Rate limit exceeded",
  "code": "RATE_LIMIT_EXCEEDED",
  "details": {
    "retry_after": 60
  }
}
```

## Best Practices

### 1. Store Session Securely

Never store session tokens in:
- Client-side JavaScript (accessible via XSS)
- URLs (logged in server logs)
- Version control (Git, etc.)

Store in:
- HTTP-only cookies (recommended)
- Server-side sessions
- Secure mobile keychains

### 2. Handle Session Expiration

```typescript
async function makeAuthenticatedRequest(url: string) {
  try {
    const response = await fetch(url, {
      headers: {
        'Authorization': `Bearer ${sessionToken}`
      }
    });

    if (response.status === 401) {
      // Session expired, re-authenticate
      await reAuthenticate();
      return makeAuthenticatedRequest(url);
    }

    return response.json();
  } catch (error) {
    console.error('Request failed:', error);
  }
}
```

### 3. Use Request IDs for Debugging

Every API response includes a `request_id` in the meta object:

```json
{
  "data": { ... },
  "meta": {
    "request_id": "req_abc123",
    "timestamp": "2024-01-15T10:30:00Z"
  }
}
```

Include this `request_id` when contacting support for faster issue resolution.

## KYC Tiers

Your account has a KYC (Know Your Customer) tier that affects your transaction limits:

| Tier | Transaction Limit | Held Balance Limit |
|------|-------------------|---------------------|
| none | Rp 1,000,000 | Rp 5,000,000 |
| basic | Rp 10,000,000 | Rp 50,000,000 |
| full | Unlimited | Unlimited |

Upgrade your KYC tier to increase limits:

1. Upload identity document (KTP/Paspor)
2. Upload selfie with ID
3. Wait for verification (1-2 business days)

## Troubleshooting

### "Invalid email or password" Error

- Verify credentials are correct
- Check for extra spaces in email/password
- Ensure account is registered

### "Session expired" Error

- Log in again to get a new session token
- Implement auto-relogin in your application

### 401 Unauthorized on All Requests

- Verify session cookie is being sent
- Check that cookie domain matches API domain
- Ensure cookie hasn't been cleared by browser

### "Rate limit exceeded" Error

- Implement exponential backoff for retries
- Cache responses where appropriate
- Contact support if you need higher limits
