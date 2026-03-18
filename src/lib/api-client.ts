/**
 * API Client for making authenticated requests to the backend
 */

export interface SellerBalances {
  held_balance: number;
  available_balance: number;
  pending_payouts: number;
  total_paid_out: number;
}

export interface BankAccount {
  id: string;
  bank_code: string;
  account_number: string;
  account_name: string;
  is_primary: boolean;
  verified_at?: string;
  created_at: string;
  updated_at: string;
}

export interface Payout {
  id: string;
  seller_id: string;
  amount: number;
  fee_amount: number;
  net_amount: number;
  status: string;
  bank_code: string;
  account_number: string;
  account_name: string;
  disbursement_ref?: string;
  failed_reason?: string;
  requested_at: string;
  processing_at?: string;
  completed_at?: string;
  created_at: string;
  updated_at: string;
}

export interface Transaction {
  id: string;
  seller_id: string;
  buyer_email: string;
  buyer_phone: string;
  amount: number;
  fee_rate: number;
  fee_amount: number;
  net_amount: number;
  gateway: string;
  gateway_transaction_id?: string;
  status: string;
  auto_release_days?: number;
  auto_release_at?: string;
  absolute_expire_at?: string;
  shipped_at?: string;
  release_reason?: string;
  refunded_at?: string;
  refund_reason?: string;
  metadata?: Record<string, unknown>;
  last_checked_at?: string;
  created_at: string;
  updated_at: string;
  released_at?: string;
}

export interface TransactionListParams {
  status?: string;
  search?: string;
  page?: number;
  limit?: number;
}

export interface TransactionListResponse {
  transactions: Transaction[];
  total: number;
  page: number;
  limit: number;
}

export interface TransactionDetailResponse extends Transaction {
  ledger_entries?: Array<{
    id: string;
    type: string;
    amount: number;
    direction: string;
    balance_after: number;
    note?: string;
    created_at: string;
  }>;
}

/**
 * Fetch transactions for the authenticated seller
 */
export async function fetchTransactions(
  params?: TransactionListParams
): Promise<TransactionListResponse> {
  const queryParams = new URLSearchParams();

  if (params?.status) {
    queryParams.append('status', params.status);
  }
  if (params?.search) {
    queryParams.append('search', params.search);
  }
  if (params?.page) {
    queryParams.append('page', params.page.toString());
  }
  if (params?.limit) {
    queryParams.append('limit', params.limit.toString());
  }

  const queryString = queryParams.toString();
  const url = `/api/v1/seller/transactions${queryString ? `?${queryString}` : ''}`;

  const response = await fetch(url);

  if (!response.ok) {
    throw new Error(`Failed to fetch transactions: ${response.statusText}`);
  }

  const result = await response.json();
  return result.data;
}

/**
 * Fetch a single transaction by ID
 */
export async function fetchTransaction(id: string): Promise<TransactionDetailResponse> {
  const response = await fetch(`/api/v1/transactions/${id}`);

  if (!response.ok) {
    throw new Error(`Failed to fetch transaction: ${response.statusText}`);
  }

  const result = await response.json();
  return result.data;
}

/**
 * Mark a transaction as shipped
 */
export async function markAsShipped(
  transactionId: string,
  trackingNumber?: string
): Promise<Transaction> {
  const response = await fetch(`/api/v1/transactions/${transactionId}/ship`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ tracking_number: trackingNumber }),
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error?.message || 'Failed to mark as shipped');
  }

  const result = await response.json();
  return result.data;
}

/**
 * Format currency in Indonesian Rupiah
 */
export function formatRupiah(amount: number): string {
  return new Intl.NumberFormat('id-ID', {
    style: 'currency',
    currency: 'IDR',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount);
}

/**
 * Format date to locale string
 */
export function formatDate(dateString: string): string {
  const date = new Date(dateString);
  return date.toLocaleDateString('id-ID', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });
}

/**
 * Format date and time to locale string
 */
export function formatDateTime(dateString: string): string {
  const date = new Date(dateString);
  return date.toLocaleString('id-ID', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

/**
 * Get status badge color class
 */
export function getStatusColor(status: string): string {
  const colors: Record<string, string> = {
    pending: 'bg-yellow-100 text-yellow-800',
    funded: 'bg-blue-100 text-blue-800',
    held: 'bg-purple-100 text-purple-800',
    released: 'bg-green-100 text-green-800',
    paid_out: 'bg-emerald-100 text-emerald-800',
    disputed: 'bg-red-100 text-red-800',
    refunded: 'bg-gray-100 text-gray-800',
    resolved: 'bg-indigo-100 text-indigo-800',
    expired: 'bg-orange-100 text-orange-800',
  };

  return colors[status] || 'bg-gray-100 text-gray-800';
}

/**
 * Get status label in Indonesian
 */
export function getStatusLabel(status: string): string {
  const labels: Record<string, string> = {
    pending: 'Menunggu Pembayaran',
    funded: 'Dana Masuk',
    held: 'Dana Ditahan',
    released: 'Dana Dilepas',
    paid_out: 'Sudah Ditarik',
    disputed: 'Disputasi',
    refunded: 'Dikembalikan',
    resolved: 'Selesai',
    expired: 'Kadaluarsa',
  };

  return labels[status] || status;
}

/**
 * Fetch seller balances
 */
export async function fetchSellerBalances(): Promise<SellerBalances> {
  const response = await fetch('/api/v1/seller/balance');

  if (!response.ok) {
    throw new Error(`Failed to fetch balances: ${response.statusText}`);
  }

  const result = await response.json();
  return result.data;
}

/**
 * Fetch seller bank accounts
 */
export async function fetchBankAccounts(): Promise<BankAccount[]> {
  const response = await fetch('/api/v1/seller/bank-accounts');

  if (!response.ok) {
    throw new Error(`Failed to fetch bank accounts: ${response.statusText}`);
  }

  const result = await response.json();
  return result.data;
}

/**
 * Fetch payout history
 */
export async function fetchPayoutHistory(): Promise<Payout[]> {
  const response = await fetch('/api/v1/seller/payouts');

  if (!response.ok) {
    throw new Error(`Failed to fetch payout history: ${response.statusText}`);
  }

  const result = await response.json();
  return result.data;
}

/**
 * Create payout request
 */
export async function createPayoutRequest(params: {
  amount: number;
  bank_account_id: string;
  notes?: string;
}): Promise<Payout> {
  const response = await fetch('/api/v1/payouts', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(params),
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error?.message || 'Failed to create payout request');
  }

  const result = await response.json();
  return result.data;
}
