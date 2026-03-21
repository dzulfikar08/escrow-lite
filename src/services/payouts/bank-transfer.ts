/**
 * Bank Transfer Service (Stub)
 *
 * MVP stub implementation for simulating bank transfer processing.
 * In production, this would integrate with actual payment gateways
 * like Midtrans Disbursement, Xendit Disbursement, or DOKU Disbursement.
 *
 * Current Implementation:
 * - Simulates processing delay (1 second)
 * - 95% success rate for realistic testing
 * - Returns stub reference for successful transfers
 * - Returns error for failed transfers
 *
 * @example
 * ```typescript
 * const result = await initiateBankTransfer(
 *   'BCA',
 *   '1234567890',
 *   'John Doe',
 *   5000000
 * );
 *
 * if (result.success) {
 *   console.log('Reference:', result.reference);
 * } else {
 *   console.error('Error:', result.error);
 * }
 * ```
 */

/**
 * Bank transfer result
 */
export interface BankTransferResult {
  success: boolean;
  reference?: string;
  error?: string;
}

const DEFAULT_PROCESSING_DELAY_MS = 1000;

function getProcessingDelayMs(): number {
  const override = (
    globalThis as typeof globalThis & {
      __BANK_TRANSFER_DELAY_MS__?: number;
    }
  ).__BANK_TRANSFER_DELAY_MS__;

  return typeof override === 'number' && override >= 0
    ? override
    : DEFAULT_PROCESSING_DELAY_MS;
}

function getRandomValue(): number {
  const override = (
    globalThis as typeof globalThis & {
      __BANK_TRANSFER_RANDOM__?: () => number;
    }
  ).__BANK_TRANSFER_RANDOM__;

  return typeof override === 'function' ? override() : Math.random();
}

/**
 * Bank codes supported by the system
 */
export type BankCode =
  | 'BCA'
  | 'BRI'
  | 'MANDIRI'
  | 'BNI'
  | 'CIMB'
  | 'PERMATA'
  | 'JENIUS'
  | 'DIGIBANK'
  | 'JAGO'
  | 'OTHER';

/**
 * Initiate a bank transfer (stub implementation)
 *
 * Simulates a bank transfer with:
 * - 1 second processing delay
 * - 95% success rate
 * - Random UUID reference for successful transfers
 *
 * @param bankCode - Bank code (e.g., "BCA", "BRI")
 * @param accountNumber - Bank account number
 * @param accountName - Account holder name
 * @param amount - Amount to transfer in IDR (must be positive)
 * @returns Promise with transfer result
 *
 * @example
 * ```typescript
 * const result = await initiateBankTransfer(
 *   'BCA',
 *   '1234567890',
 *   'John Doe',
 *   5000000
 * );
 * ```
 */
export async function initiateBankTransfer(
  bankCode: string,
  accountNumber: string,
  accountName: string,
  amount: number
): Promise<BankTransferResult> {
  // Validate inputs
  if (!bankCode || bankCode.trim().length === 0) {
    return {
      success: false,
      error: 'Bank code is required',
    };
  }

  if (!accountNumber || accountNumber.trim().length === 0) {
    return {
      success: false,
      error: 'Account number is required',
    };
  }

  if (!accountName || accountName.trim().length === 0) {
    return {
      success: false,
      error: 'Account name is required',
    };
  }

  if (!Number.isInteger(amount) || amount <= 0) {
    return {
      success: false,
      error: 'Amount must be a positive integer',
    };
  }

  // Simulate processing delay while still allowing fast test execution.
  await new Promise((resolve) => setTimeout(resolve, getProcessingDelayMs()));

  // Simulate 95% success rate
  // In production, this would call actual bank API
  const isSuccess = getRandomValue() > 0.05;

  if (isSuccess) {
    // Generate stub reference
    const reference = `STUB-${crypto.randomUUID()}`;

    return {
      success: true,
      reference,
    };
  }

  // Simulate failure
  return {
    success: false,
    error: 'Bank transfer failed (stub)',
  };
}

/**
 * Validate bank account details
 *
 * Checks if bank account details are valid before initiating transfer.
 * This is a basic validation - in production, you might want to
 * perform penny-drop verification or bank account verification.
 *
 * @param bankCode - Bank code
 * @param accountNumber - Bank account number
 * @param accountName - Account holder name
 * @returns true if valid, false otherwise
 */
export function validateBankAccount(
  bankCode: string,
  accountNumber: string,
  accountName: string
): boolean {
  // Basic validation
  if (!bankCode || bankCode.trim().length === 0) {
    return false;
  }

  if (!accountNumber || accountNumber.trim().length < 5) {
    return false;
  }

  if (!accountName || accountName.trim().length === 0) {
    return false;
  }

  return true;
}

/**
 * Get list of supported bank codes
 *
 * Returns array of supported bank codes for frontend display.
 *
 * @returns Array of bank codes
 */
export function getSupportedBanks(): Array<{
  code: BankCode;
  name: string;
}> {
  return [
    { code: 'BCA', name: 'Bank Central Asia' },
    { code: 'BRI', name: 'Bank Rakyat Indonesia' },
    { code: 'MANDIRI', name: 'Bank Mandiri' },
    { code: 'BNI', name: 'Bank Nasional Indonesia' },
    { code: 'CIMB', name: 'CIMB Niaga' },
    { code: 'PERMATA', name: 'Bank Permata' },
    { code: 'JENIUS', name: 'Jenius' },
    { code: 'DIGIBANK', name: 'DBS Digibank' },
    { code: 'JAGO', name: 'Bank Jago' },
    { code: 'OTHER', name: 'Other Bank' },
  ];
}
