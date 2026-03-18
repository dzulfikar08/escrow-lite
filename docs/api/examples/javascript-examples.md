# JavaScript/TypeScript Examples

Collection of JavaScript and TypeScript examples for Escrow Lite API.

## Setup

```typescript
// api-client.ts
interface EscrowLiteConfig {
  baseURL: string;
  sessionToken?: string;
}

class EscrowLiteClient {
  private baseURL: string;
  private sessionToken?: string;

  constructor(config: EscrowLiteConfig) {
    this.baseURL = config.baseURL;
    this.sessionToken = config.sessionToken;
  }

  private async request<T>(
    endpoint: string,
    options: RequestInit = {}
  ): Promise<T> {
    const url = `${this.baseURL}${endpoint}`;
    const headers: HeadersInit = {
      'Content-Type': 'application/json',
      ...options.headers,
    };

    if (this.sessionToken) {
      headers['Authorization'] = `Bearer ${this.sessionToken}`;
    }

    const response = await fetch(url, {
      ...options,
      headers,
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || 'Request failed');
    }

    return response.json();
  }

  setSessionToken(token: string) {
    this.sessionToken = token;
  }

  // Auth endpoints
  async register(data: {
    email: string;
    password: string;
    name: string;
  }) {
    return this.request('/api/v1/auth/register', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  async login(email: string, password: string) {
    const response = await fetch(`${this.baseURL}/api/v1/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password }),
    });

    const data = await response.json();

    // Extract session token from Set-Cookie header
    const setCookie = response.headers.get('set-cookie');
    if (setCookie) {
      const match = setCookie.match(/session=([^;]+)/);
      if (match) {
        this.sessionToken = match[1];
      }
    }

    return data;
  }

  // Transaction endpoints
  async createTransaction(data: {
    buyer_email: string;
    buyer_phone: string;
    amount: number;
    auto_release_days?: number;
    metadata?: Record<string, any>;
  }) {
    return this.request<{ data: Transaction }>('/api/v1/transactions', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  async getTransaction(id: string) {
    return this.request<{ data: Transaction }>(`/api/v1/transactions/${id}`);
  }

  async listTransactions(params?: {
    page?: number;
    limit?: number;
    status?: string;
    search?: string;
  }) {
    const query = new URLSearchParams(params as any).toString();
    return this.request<{ data: TransactionList }>(
      `/api/v1/seller/transactions?${query}`
    );
  }

  async markAsShipped(id: string, trackingNumber?: string) {
    return this.request<{ data: Transaction }>(
      `/api/v1/transactions/${id}/ship`,
      {
        method: 'POST',
        body: JSON.stringify({
          tracking_number: trackingNumber,
        }),
      }
    );
  }

  async buyerConfirm(id: string) {
    return this.request<{ data: Transaction }>(
      `/api/v1/transactions/${id}/confirm`,
      {
        method: 'POST',
      }
    );
  }

  // Balance endpoint
  async getBalance() {
    return this.request<{ data: Balance }>('/api/v1/seller/balance');
  }

  // Payout endpoints
  async createPayout(data: { amount: number; bank_account_id: string }) {
    return this.request<{ data: Payout }>('/api/v1/payouts', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  async listPayouts(params?: { page?: number; limit?: number; status?: string }) {
    const query = new URLSearchParams(params as any).toString();
    return this.request<{ data: PayoutList }>(`/api/v1/payouts?${query}`);
  }

  // Bank account endpoints
  async listBankAccounts() {
    return this.request<{ data: BankAccount[] }>('/api/v1/bank-accounts');
  }

  async addBankAccount(data: {
    bank_name: string;
    account_number: string;
    account_holder_name: string;
  }) {
    return this.request<{ data: BankAccount }>('/api/v1/bank-accounts', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  async setPrimaryBankAccount(id: string) {
    return this.request(`/api/v1/bank-accounts/${id}/primary`, {
      method: 'PUT',
    });
  }

  async deleteBankAccount(id: string) {
    return this.request(`/api/v1/bank-accounts/${id}`, {
      method: 'DELETE',
    });
  }

  // Dispute endpoints
  async listDisputes(params?: { page?: number; limit?: number; status?: string }) {
    const query = new URLSearchParams(params as any).toString();
    return this.request<{ data: Dispute[] }>(`/api/v1/disputes?${query}`);
  }

  async openDispute(data: { transaction_id: string; reason: string }) {
    return this.request<{ data: Dispute }>('/api/v1/disputes', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  async respondToDispute(id: string, response: string) {
    return this.request<{ data: Dispute }>(`/api/v1/disputes/${id}/respond`, {
      method: 'POST',
      body: JSON.stringify({ response }),
    });
  }

  async uploadEvidence(disputeId: string, file: File, description?: string) {
    const formData = new FormData();
    formData.append('file', file);
    if (description) {
      formData.append('description', description);
    }

    return this.request<{ data: Evidence }>(
      `/api/v1/disputes/${disputeId}/evidence`,
      {
        method: 'POST',
        headers: {}, // Let browser set Content-Type for FormData
        body: formData as any,
      }
    );
  }
}

// Type definitions
interface Transaction {
  id: string;
  seller_id: string;
  buyer_email: string;
  buyer_phone: string;
  amount: number;
  fee_rate: number;
  fee_amount: number;
  net_amount: number;
  gateway: 'midtrans' | 'xendit' | 'doku';
  gateway_transaction_id?: string;
  status: 'pending' | 'funded' | 'held' | 'released' | 'disputed' | 'refunded' | 'expired' | 'paid_out' | 'resolved';
  auto_release_days?: number;
  auto_release_at?: string;
  absolute_expire_at?: string;
  shipped_at?: string;
  release_reason?: 'buyer_confirmed' | 'timeout' | 'admin_override';
  released_at?: string;
  refunded_at?: string;
  created_at: string;
  updated_at: string;
}

interface TransactionList {
  transactions: Transaction[];
  total: number;
  page: number;
  limit: number;
}

interface Balance {
  held: number;
  available: number;
  pending_payouts: number;
  total_paid_out: number;
}

interface Payout {
  id: string;
  seller_id: string;
  amount: number;
  fee: number;
  net_amount: number;
  status: 'pending' | 'processing' | 'completed' | 'failed' | 'cancelled';
  bank_account: {
    bank_name: string;
    account_number_last_4: string;
  };
  created_at: string;
  updated_at: string;
}

interface PayoutList {
  payouts: Payout[];
  total: number;
  page: number;
  limit: number;
}

interface BankAccount {
  id: string;
  seller_id: string;
  bank_name: string;
  account_number: string;
  account_number_last_4: string;
  account_holder_name: string;
  is_primary: boolean;
  created_at: string;
}

interface Dispute {
  id: string;
  transaction_id: string;
  reason: string;
  status: 'open' | 'seller_responded' | 'under_review' | 'resolved' | 'closed';
  created_at: string;
  updated_at: string;
}

interface Evidence {
  evidence_id: string;
  download_url: string;
}

export default EscrowLiteClient;
```

## Usage Examples

### Initialize Client

```typescript
import EscrowLiteClient from './api-client';

const client = new EscrowLiteClient({
  baseURL: 'https://api.escrow-lite.id',
});
```

### Register and Login

```typescript
// Register
await client.register({
  email: 'seller@example.com',
  password: 'SecurePass123!',
  name: 'John Doe',
});

// Login
await client.login('seller@example.com', 'SecurePass123!');
```

### Create Transaction

```typescript
const transaction = await client.createTransaction({
  buyer_email: 'buyer@example.com',
  buyer_phone: '+628123456789',
  amount: 150000,
  auto_release_days: 3,
  metadata: {
    order_id: 'ORD-12345',
    items: 'Bluetooth Headphones',
  },
});

console.log('Transaction created:', transaction.data.id);
console.log('Payment URL:', transaction.data.payment_url);
```

### List Transactions

```typescript
// Get all transactions
const { data } = await client.listTransactions({
  page: 1,
  limit: 20,
});

console.log(`Found ${data.total} transactions`);
console.log(`Current page: ${data.page} of ${Math.ceil(data.total / data.limit)}`);

// Filter by status
const held = await client.listTransactions({ status: 'held' });

// Search
const searchResults = await client.listTransactions({
  search: 'john',
});
```

### Mark as Shipped

```typescript
await client.markAsShipped('tx_abc123', 'JNE123456789');
```

### Get Balance

```typescript
const { data } = await client.getBalance();

console.log('Held in escrow:', formatRupiah(data.held));
console.log('Available for payout:', formatRupiah(data.available));
console.log('Pending payouts:', formatRupiah(data.pending_payouts));
console.log('Total paid out:', formatRupiah(data.total_paid_out));
```

### Request Payout

```typescript
// First, add bank account
const { data: bankAccount } = await client.addBankAccount({
  bank_name: 'BCA',
  account_number: '1234567890',
  account_holder_name: 'JOHN DOE',
});

// Request payout
const { data: payout } = await client.createPayout({
  amount: 150000,
  bank_account_id: bankAccount.id,
});

console.log('Payout requested:', payout.id);
console.log('Status:', payout.status);
```

### Handle Disputes

```typescript
// Open dispute
const { data: dispute } = await client.openDispute({
  transaction_id: 'tx_abc123',
  reason: 'Item not as described',
});

// Respond to dispute
await client.respondToDispute(dispute.id, 'Item shipped correctly');

// Upload evidence
const fileInput = document.getElementById('evidence-file') as HTMLInputElement;
if (fileInput.files && fileInput.files[0]) {
  await client.uploadEvidence(
    dispute.id,
    fileInput.files[0],
    'Photo of item condition'
  );
}
```

## React Integration

### Custom Hook

```typescript
// hooks/useEscrowLite.ts
import { useState, useEffect } from 'react';
import EscrowLiteClient from '../api-client';

let client: EscrowLiteClient | null = null;

export function useEscrowLite() {
  const [sessionToken, setSessionToken] = useState<string | null>(null);

  useEffect(() => {
    // Initialize client
    if (!client) {
      client = new EscrowLiteClient({
        baseURL: process.env.NEXT_PUBLIC_API_URL || 'https://api.escrow-lite.id',
      });
    }

    // Load session from localStorage
    const savedSession = localStorage.getItem('escrow_session');
    if (savedSession) {
      setSessionToken(savedSession);
      client.setSessionToken(savedSession);
    }
  }, []);

  const login = async (email: string, password: string) => {
    if (!client) throw new Error('Client not initialized');

    const response = await client.login(email, password);
    if (client.sessionToken) {
      setSessionToken(client.sessionToken);
      localStorage.setItem('escrow_session', client.sessionToken);
    }
    return response;
  };

  const logout = () => {
    setSessionToken(null);
    localStorage.removeItem('escrow_session');
    if (client) client.setSessionToken('');
  };

  return {
    client,
    sessionToken,
    login,
    logout,
  };
}
```

### Component Example

```typescript
// components/TransactionForm.tsx
import { useState } from 'react';
import { useEscrowLite } from '../hooks/useEscrowLite';

export function TransactionForm() {
  const { client, sessionToken } = useEscrowLite();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!client || !sessionToken) return;

    setLoading(true);
    setError(null);

    try {
      const formData = new FormData(e.currentTarget);
      const { data } = await client.createTransaction({
        buyer_email: formData.get('email') as string,
        buyer_phone: formData.get('phone') as string,
        amount: Number(formData.get('amount')),
        auto_release_days: Number(formData.get('auto_release_days') || 3),
      });

      console.log('Transaction created:', data);
      // Redirect or show success message
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  if (!sessionToken) {
    return <div>Please login first</div>;
  }

  return (
    <form onSubmit={handleSubmit}>
      <input type="email" name="email" placeholder="Buyer email" required />
      <input type="tel" name="phone" placeholder="Buyer phone" required />
      <input
        type="number"
        name="amount"
        placeholder="Amount (IDR)"
        required
      />
      <select name="auto_release_days">
        <option value="1">1 day</option>
        <option value="3" selected>
          3 days
        </option>
        <option value="7">7 days</option>
      </select>
      <button type="submit" disabled={loading}>
        {loading ? 'Creating...' : 'Create Transaction'}
      </button>
      {error && <div className="error">{error}</div>}
    </form>
  );
}
```

## Node.js Integration

### Express Middleware

```typescript
// middleware/escrow-auth.ts
import { Request, Response, NextFunction } from 'express';

export interface EscrowAuthRequest extends Request {
  session?: {
    userId: string;
    email: string;
    kycTier: string;
  };
}

export async function escrowAuth(
  req: EscrowAuthRequest,
  res: Response,
  next: NextFunction
) {
  const token = req.headers.authorization?.replace('Bearer ', '');

  if (!token) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  try {
    // Verify token with Escrow Lite API
    const response = await fetch('https://api.escrow-lite.id/api/v1/auth/me', {
      headers: { Authorization: `Bearer ${token}` },
    });

    if (!response.ok) {
      return res.status(401).json({ error: 'Invalid token' });
    }

    const { data } = await response.json();
    req.session = data;
    next();
  } catch (error) {
    res.status(500).json({ error: 'Authentication failed' });
  }
}
```

### Usage in Express

```typescript
import express from 'express';
import { escrowAuth } from './middleware/escrow-auth';

const app = express();

app.get('/api/transactions', escrowAuth, async (req, res) => {
  const client = new EscrowLiteClient({
    baseURL: 'https://api.escrow-lite.id',
    sessionToken: req.headers.authorization?.replace('Bearer ', ''),
  });

  const { data } = await client.listTransactions();
  res.json(data);
});
```

## Error Handling

```typescript
async function safeTransactionCreation() {
  try {
    const { data } = await client.createTransaction({
      buyer_email: 'buyer@example.com',
      buyer_phone: '+628123456789',
      amount: 150000,
    });
    return { success: true, data };
  } catch (error: any) {
    // Handle specific errors
    if (error.message.includes('VALIDATION_ERROR')) {
      return { success: false, error: 'Invalid input data' };
    }
    if (error.message.includes('AUTHENTICATION_ERROR')) {
      return { success: false, error: 'Please login again' };
    }
    if (error.message.includes('CONFLICT_ERROR')) {
      return { success: false, error: 'Transaction already exists' };
    }
    return { success: false, error: 'Something went wrong' };
  }
}
```

## Testing

```typescript
// tests/api-client.test.ts
import { describe, it, expect, beforeEach } from 'vitest';
import EscrowLiteClient from '../api-client';

describe('EscrowLiteClient', () => {
  let client: EscrowLiteClient;

  beforeEach(() => {
    client = new EscrowLiteClient({
      baseURL: 'https://sandbox.escrow-lite.id',
    });
  });

  it('should create a transaction', async () => {
    await client.login('test@example.com', 'password');
    const { data } = await client.createTransaction({
      buyer_email: 'buyer@example.com',
      buyer_phone: '+628123456789',
      amount: 150000,
    });

    expect(data.id).toBeDefined();
    expect(data.status).toBe('pending');
  });

  it('should handle authentication errors', async () => {
    await expect(
      client.login('invalid@example.com', 'wrong')
    ).rejects.toThrow('AUTHENTICATION_ERROR');
  });
});
```

## Utility Functions

```typescript
// utils/currency.ts
export function formatRupiah(amount: number): string {
  return new Intl.NumberFormat('id-ID', {
    style: 'currency',
    currency: 'IDR',
    minimumFractionDigits: 0,
  }).format(amount);
}

// utils/status.ts
export function getStatusColor(status: string): string {
  const colors: Record<string, string> = {
    pending: 'gray',
    funded: 'blue',
    held: 'yellow',
    released: 'green',
    disputed: 'red',
    refunded: 'orange',
    expired: 'gray',
    paid_out: 'green',
    resolved: 'blue',
  };
  return colors[status] || 'gray';
}

export function getStatusLabel(status: string): string {
  const labels: Record<string, string> = {
    pending: 'Menunggu Pembayaran',
    funded: 'Dana Diterima',
    held: 'Dana Ditahan',
    released: 'Dana Dilepas',
    disputed: 'Dispute',
    refunded: 'Dana Dikembalikan',
    expired: 'Kedaluwarsa',
    paid_out: 'Sudah Dibayar',
    resolved: 'Selesai',
  };
  return labels[status] || status;
}
```

## Best Practices

1. **Always handle errors** with try-catch
2. **Use TypeScript** for type safety
3. **Store session tokens securely** (httpOnly cookies)
4. **Implement request retries** for network failures
5. **Cache responses** where appropriate
6. **Validate input** before sending to API
7. **Log request IDs** for debugging
8. **Use environment variables** for configuration
