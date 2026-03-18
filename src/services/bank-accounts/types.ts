/**
 * Bank Account Service Types
 */

/**
 * Supported Indonesian banks with their account number requirements
 */
export const INDONESIAN_BANKS = {
  'BCA': { name: 'Bank Central Asia', code: 'BCA', digits: 10 },
  'BNI': { name: 'Bank Negara Indonesia', code: 'BNI', digits: 10 },
  'BRI': { name: 'Bank Rakyat Indonesia', code: 'BRI', digits: 15 },
  'MANDIRI': { name: 'Mandiri', code: 'MDR', digits: 13 },
  'CIMB': { name: 'CIMB Niaga', code: 'CIMB', digits: 12 },
  'DANAMON': { name: 'Danamon Indonesia', code: 'BDM', digits: 10 },
  'PERMATA': { name: 'Bank Permata', code: 'BBVA', digits: 10 },
  'BTPN': { name: 'BTPN', code: 'BTPN', digits: 10 },
} as const;

export type IndonesianBankCode = keyof typeof INDONESIAN_BANKS;
export type BankCode = IndonesianBankCode | string;

/**
 * Bank account entity
 */
export interface BankAccount {
  id: string;
  seller_id: string;
  bank_code: IndonesianBankCode;
  bank_name: string;
  account_number: string;
  account_name: string;
  is_primary: boolean;
  verified_at?: string;
  created_at: string;
  updated_at: string;
}

/**
 * Masked bank account (for API responses)
 */
export interface MaskedBankAccount {
  id: string;
  bank_code: IndonesianBankCode;
  bank_name: string;
  account_number_last4: string;
  masked_account_number: string;
  account_name: string;
  is_primary: boolean;
  verified_at?: string;
  created_at: string;
}

/**
 * Add bank account DTO
 */
export interface AddBankAccountDto {
  bank_code: IndonesianBankCode;
  account_number: string;
  account_name: string;
}

/**
 * Validation result
 */
export interface ValidationResult {
  valid: boolean;
  errors: string[];
}

/**
 * Bank account info
 */
export interface BankInfo {
  name: string;
  code: string;
  digits: number;
}
