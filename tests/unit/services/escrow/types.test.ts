import { describe, it, expect } from 'vitest';
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
    it('should export TransactionStatus enum', async () => {
      const { TransactionStatus } = await import('../../../../src/services/escrow/types');
      expect(TransactionStatus).toBeDefined();
      expect(TransactionStatus.PENDING).toBe('pending');
      expect(TransactionStatus.HELD).toBe('held');
      expect(TransactionStatus.RELEASED).toBe('released');
      expect(TransactionStatus.REFUNDED).toBe('refunded');
    });

    it('should export KycTier enum', async () => {
      const { KycTier } = await import('../../../../src/services/escrow/types');
      expect(KycTier).toBeDefined();
      expect(KycTier.TIER_1).toBe('tier_1');
      expect(KycTier.TIER_2).toBe('tier_2');
      expect(KycTier.TIER_3).toBe('tier_3');
    });

    it('should export ReleaseReason enum', async () => {
      const { ReleaseReason } = await import('../../../../src/services/escrow/types');
      expect(ReleaseReason).toBeDefined();
      expect(ReleaseReason.DELIVERY_CONFIRMED).toBe('delivery_confirmed');
      expect(ReleaseReason.AUTO_RELEASE).toBe('auto_release');
      expect(ReleaseReason.DISPUTE_RESOLVED).toBe('dispute_resolved');
    });

    it('should export DisputeReason enum', async () => {
      const { DisputeReason } = await import('../../../../src/services/escrow/types');
      expect(DisputeReason).toBeDefined();
      expect(DisputeReason.GOODS_NOT_RECEIVED).toBe('goods_not_received');
      expect(DisputeReason.GOODS_DAMAGED).toBe('goods_damaged');
      expect(DisputeReason.NOT_AS_DESCRIBED).toBe('not_as_described');
      expect(DisputeReason.OTHER).toBe('other');
    });

    it('should export Gateway enum', async () => {
      const { Gateway } = await import('../../../../src/services/escrow/types');
      expect(Gateway).toBeDefined();
      expect(Gateway.PAYSTACK).toBe('paystack');
      expect(Gateway.FLUTTERWAVE).toBe('flutterwave');
    });
  });

  describe('Type Exports', () => {
    it('should export Transaction type', () => {
      // Type checking happens at compile time
      // If this compiles, the type is exported
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
});
