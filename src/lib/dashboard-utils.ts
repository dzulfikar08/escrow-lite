/**
 * Dashboard utility functions for formatting dates, currencies, and status labels
 */

/**
 * Format amount to Indonesian Rupiah currency string
 * @param amount - Amount in IDR (integer)
 * @returns Formatted currency string (e.g., "Rp 1.000.000")
 */
export function formatRupiah(amount: number): string {
  return new Intl.NumberFormat('id-ID', {
    style: 'currency',
    currency: 'IDR',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0
  }).format(amount);
}

/**
 * Format ISO date string to Indonesian locale
 * @param dateString - ISO 8601 date string
 * @returns Formatted date string (e.g., "18 Mar 2026, 10:30")
 */
export function formatDate(dateString: string): string {
  const date = new Date(dateString);
  return new Intl.DateTimeFormat('id-ID', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  }).format(date);
}

/**
 * Format ISO date string to short Indonesian date (no time)
 * @param dateString - ISO 8601 date string
 * @returns Formatted date string (e.g., "18 Mar 2026")
 */
export function formatShortDate(dateString: string): string {
  const date = new Date(dateString);
  return new Intl.DateTimeFormat('id-ID', {
    day: 'numeric',
    month: 'short',
    year: 'numeric'
  }).format(date);
}

/**
 * Get status badge color class
 * @param status - Transaction status
 * @returns CSS color class name
 */
export function getStatusColor(status: string): string {
  const colors: Record<string, string> = {
    held: 'yellow',
    released: 'green',
    disputed: 'red',
    refunded: 'gray',
    pending: 'blue',
    funded: 'blue',
    expired: 'gray'
  };
  return colors[status] || 'gray';
}

/**
 * Get Indonesian label for transaction status
 * @param status - Transaction status
 * @returns Indonesian status label
 */
export function getStatusLabel(status: string): string {
  const labels: Record<string, string> = {
    held: 'Ditahan',
    released: 'Dirilis',
    disputed: 'Disengketakan',
    refunded: 'Dikembalikan',
    pending: 'Pending',
    funded: 'Dana Masuk',
    expired: 'Kedaluwarsa'
  };
  return labels[status] || status;
}

/**
 * Get Indonesian label for payout status
 * @param status - Payout status
 * @returns Indonesian status label
 */
export function getPayoutStatusLabel(status: string): string {
  const labels: Record<string, string> = {
    pending: 'Pending',
    processing: 'Diproses',
    completed: 'Selesai',
    failed: 'Gagal'
  };
  return labels[status] || status;
}

/**
 * Mask email address for privacy
 * @param email - Full email address
 * @returns Masked email (e.g., "bu***@gmail.com")
 */
export function maskEmail(email: string): string {
  const [localPart, domain] = email.split('@');
  if (localPart.length <= 2) {
    return `${localPart[0]}***@${domain}`;
  }
  return `${localPart.slice(0, 2)}***@${domain}`;
}

/**
 * Calculate percentage change between two values
 * @param current - Current value
 * @param previous - Previous value
 * @returns Percentage change (can be negative)
 */
export function calculatePercentageChange(current: number, previous: number): number {
  if (previous === 0) return current > 0 ? 100 : 0;
  return ((current - previous) / previous) * 100;
}

/**
 * Truncate text with ellipsis
 * @param text - Text to truncate
 * @param maxLength - Maximum length
 * @returns Truncated text with ellipsis if needed
 */
export function truncateText(text: string, maxLength: number): string {
  if (text.length <= maxLength) return text;
  return text.slice(0, maxLength) + '...';
}
