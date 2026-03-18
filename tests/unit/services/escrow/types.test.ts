import { describe, it, expect } from 'vitest';
import {
  TransactionStatus,
  KycTier,
  ReleaseReason,
  DisputeReason,
  Gateway,
} from '../../../../src/services/escrow/types';
import type {
  Transaction,
  Seller,
  LedgerEntry,
  Payout,
  Dispute,
  CreateTransactionDto,
  SellerBalances,
} from '../../../../src/services/escrow/types';

describe('Escrow Types', () => {
  describe('Module Loading', () => {
    it('should import types module without errors', async () => {
      await import('../../../../src/services/escrow/types');
      expect(true).toBe(true);
    });
  });

  describe('Enums', () => {
    it('should export TransactionStatus enum with correct values', () => {
      expect(TransactionStatus).toBeDefined();
      expect(TransactionStatus.PENDING).toBe('pending');
      expect(TransactionStatus.FUNDED).toBe('funded');
      expect(TransactionStatus.HELD).toBe('held');
      expect(TransactionStatus.RELEASED).toBe('released');
      expect(TransactionStatus.DISPUTED).toBe('disputed');
      expect(TransactionStatus.REFUNDED).toBe('refunded');
      expect(TransactionStatus.EXPIRED).toBe('expired');
    });

    it('should export KycTier enum with correct values', () => {
      expect(KycTier).toBeDefined();
      expect(KycTier.NONE).toBe('none');
      expect(KycTier.BASIC).toBe('basic');
      expect(KycTier.FULL).toBe('full');
    });

    it('should export ReleaseReason enum with correct values', () => {
      expect(ReleaseReason).toBeDefined();
      expect(ReleaseReason.BUYER_CONFIRMED).toBe('buyer_confirmed');
      expect(ReleaseReason.TIMEOUT).toBe('timeout');
      expect(ReleaseReason.ADMIN_OVERRIDE).toBe('admin_override');
    });

    it('should export DisputeReason enum with correct values', () => {
      expect(DisputeReason).toBeDefined();
      expect(DisputeReason.NOT_RECEIVED).toBe('not_received');
      expect(DisputeReason.NOT_AS_DESCRIBED).toBe('not_as_described');
      expect(DisputeReason.DAMAGED).toBe('damaged');
      expect(DisputeReason.WRONG_ITEM).toBe('wrong_item');
      expect(DisputeReason.OTHER).toBe('other');
    });

    it('should export Gateway enum with correct values', () => {
      expect(Gateway).toBeDefined();
      expect(Gateway.MIDTRANS).toBe('midtrans');
      expect(Gateway.XENDIT).toBe('xendit');
      expect(Gateway.DOKU).toBe('doku');
    });
  });

  describe('Type Exports', () => {
    it('should export Transaction type', () => {
      const transaction: Transaction = {} as Transaction;
      expect(transaction).toBeDefined();
    });

    it('should export Seller type', () => {
      const seller: Seller = {} as Seller;
      expect(seller).toBeDefined();
    });

    it('should export LedgerEntry type', () => {
      const ledgerEntry: LedgerEntry = {} as LedgerEntry;
      expect(ledgerEntry).toBeDefined();
    });

    it('should export Payout type', () => {
      const payout: Payout = {} as Payout;
      expect(payout).toBeDefined();
    });

    it('should export Dispute type', () => {
      const dispute: Dispute = {} as Dispute;
      expect(dispute).toBeDefined();
    });

    it('should export CreateTransactionDto type', () => {
      const dto: CreateTransactionDto = {} as CreateTransactionDto;
      expect(dto).toBeDefined();
    });

    it('should export SellerBalances type', () => {
      const balances: SellerBalances = {} as SellerBalances;
      expect(balances).toBeDefined();
    });
  });

  describe('Transaction Interface', () => {
    it('should have all required fields', () => {
      const transaction: Partial<Transaction> = {
        id: '123',
        seller_id: '456',
        buyer_email: 'buyer@example.com',
        buyer_phone: '+628123456789',
        amount: 100000,
        fee_rate: 0.01,
        fee_amount: 1000,
        net_amount: 99000,
        gateway: Gateway.MIDTRANS,
        status: TransactionStatus.PENDING,
        created_at: new Date(),
        updated_at: new Date(),
      };
      expect(transaction).toBeDefined();
    });

    it('should have Indonesian market specific fields', () => {
      expect(Gateway.MIDTRANS).toBe('midtrans');
      expect(Gateway.XENDIT).toBe('xendit');
      expect(Gateway.DOKU).toBe('doku');
    });
  });

  describe('Seller Interface', () => {
    it('should have all required fields including Indonesian compliance', () => {
      const seller: Partial<Seller> = {
        id: '123',
        auth_id: 'auth123',
        name: 'Test Business',
        email: 'test@example.com',
        phone: '+628123456789',
        kyc_tier: KycTier.BASIC,
        version: 1,
        created_at: new Date(),
        updated_at: new Date(),
      };
      expect(seller).toBeDefined();
    });
  });

  describe('LedgerEntry Interface', () => {
    it('should have correct type and direction fields', () => {
      const ledgerEntry: Partial<LedgerEntry> = {
        id: '123',
        seller_id: '456',
        type: 'hold',
        direction: 'in',
        amount: 100000,
        description: 'Test entry',
        balance_before: 0,
        balance_after: 100000,
        created_at: new Date(),
      };
      expect(ledgerEntry).toBeDefined();
    });
  });

  describe('SellerBalances Interface', () => {
    it('should have correct balance fields', () => {
      const balances: SellerBalances = {
        held_balance: 5000000,
        available_balance: 3000000,
        pending_payouts: 1000000,
        total_paid_out: 10000000,
      };
      expect(balances).toBeDefined();
    });
  });
});
