import { describe, it, expect, beforeEach, vi } from 'vitest';
import { DisputeService } from '../../../../src/services/disputes/service';
import { DisputeStatus, DisputeReason } from '../../../../src/services/disputes/types';
import { EscrowEngine } from '../../../../src/services/escrow/engine';
import { LedgerService } from '../../../../src/services/escrow/ledger';
import { NotFoundError, ConflictError, ValidationError } from '../../../../src/lib/errors';

describe('DisputeService', () => {
  let db: D1Database;
  let engine: EscrowEngine;
  let ledger: LedgerService;
  let service: DisputeService;

  beforeEach(() => {
    // Mock D1 database
    db = {
      prepare: vi.fn().mockReturnThis(),
      bind: vi.fn().mockReturnThis(),
      first: vi.fn(),
      run: vi.fn(),
      all: vi.fn(),
    } as unknown as D1Database;

    // Mock EscrowEngine
    engine = {
      getTransaction: vi.fn(),
      openDispute: vi.fn(),
      resolveDispute: vi.fn(),
      approveRefund: vi.fn(),
      finalizeRelease: vi.fn(),
    } as unknown as EscrowEngine;

    // Mock LedgerService
    ledger = {
      recordRefund: vi.fn(),
      getBalance: vi.fn(),
    } as unknown as LedgerService;

    service = new DisputeService(db, engine, ledger);
  });

  describe('openDispute', () => {
    it('should successfully open a dispute for a held transaction', async () => {
      const transaction = {
        id: 'tx_123',
        seller_id: 'seller_1',
        buyer_email: 'buyer@example.com',
        buyer_phone: '+628123456789',
        amount: 100000,
        status: 'held',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };

      const mockCreatedDispute = {
        id: 'dsp_123',
        transaction_id: 'tx_123',
        reason: DisputeReason.NOT_RECEIVED,
        description: 'Item not received',
        status: DisputeStatus.OPEN,
        buyer_email: 'buyer@example.com',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };

      vi.mocked(engine.getTransaction).mockResolvedValue(transaction as any);
      vi.mocked(engine.openDispute).mockResolvedValue(transaction as any);

      // Mock database queries
      // First call: check for existing dispute (returns null)
      // Second call: get seller email (returns email)
      // Third call: get created dispute (returns mock)
      vi.mocked(db.first)
        .mockResolvedValueOnce(null) // No existing dispute
        .mockResolvedValueOnce({ email: 'seller@example.com' } as any) // Seller email
        .mockResolvedValueOnce(mockCreatedDispute as any); // Created dispute

      vi.mocked(db.run).mockResolvedValue({ success: true } as any);
      vi.mocked(db.all).mockResolvedValue({ results: [{ count: 0 }] } as any);

      const result = await service.openDispute(
        'tx_123',
        DisputeReason.NOT_RECEIVED,
        'Item not received',
        'buyer@example.com'
      );

      expect(result).toBeDefined();
      expect(result.status).toBe(DisputeStatus.OPEN);
      expect(engine.openDispute).toHaveBeenCalledWith('tx_123', DisputeReason.NOT_RECEIVED);
    });

    it('should throw NotFoundError when transaction does not exist', async () => {
      vi.mocked(engine.getTransaction).mockResolvedValue(null);

      await expect(
        service.openDispute(
          'tx_123',
          DisputeReason.NOT_RECEIVED,
          'Item not received',
          'buyer@example.com'
        )
      ).rejects.toThrow(NotFoundError);
    });

    it('should throw ConflictError when transaction is not in HELD status', async () => {
      const transaction = {
        id: 'tx_123',
        status: 'pending',
        buyer_email: 'buyer@example.com',
      };

      vi.mocked(engine.getTransaction).mockResolvedValue(transaction as any);

      await expect(
        service.openDispute(
          'tx_123',
          DisputeReason.NOT_RECEIVED,
          'Item not received',
          'buyer@example.com'
        )
      ).rejects.toThrow(ConflictError);
    });

    it('should throw ValidationError when dispute already exists', async () => {
      const transaction = {
        id: 'tx_123',
        status: 'held',
        buyer_email: 'buyer@example.com',
      };

      vi.mocked(engine.getTransaction).mockResolvedValue(transaction as any);
      vi.mocked(db.first).mockResolvedValueOnce({ id: 'dsp_existing' } as any); // Existing dispute

      await expect(
        service.openDispute(
          'tx_123',
          DisputeReason.NOT_RECEIVED,
          'Item not received',
          'buyer@example.com'
        )
      ).rejects.toThrow(ValidationError);
    });

    it('should throw ValidationError when buyer email does not match', async () => {
      const transaction = {
        id: 'tx_123',
        status: 'held',
        buyer_email: 'different@example.com',
      };

      vi.mocked(engine.getTransaction).mockResolvedValue(transaction as any);
      vi.mocked(db.first).mockResolvedValueOnce(null);

      await expect(
        service.openDispute(
          'tx_123',
          DisputeReason.NOT_RECEIVED,
          'Item not received',
          'buyer@example.com'
        )
      ).rejects.toThrow(ValidationError);
    });
  });

  describe('sellerResponse', () => {
    it('should successfully submit seller response', async () => {
      const dispute = {
        id: 'dsp_123',
        transaction_id: 'tx_123',
        status: DisputeStatus.OPEN,
        buyer_email: 'buyer@example.com',
      };

      const transaction = {
        id: 'tx_123',
        seller_id: 'seller_1',
      };

      const mockUpdatedDispute = {
        id: 'dsp_123',
        transaction_id: 'tx_123',
        status: DisputeStatus.SELLER_RESPONDING,
        seller_response: 'Item was shipped on time',
        seller_responded_at: new Date().toISOString(),
        buyer_email: 'buyer@example.com',
      };

      vi.mocked(db.first)
        .mockResolvedValueOnce(dispute as any) // Dispute exists
        .mockResolvedValueOnce({ seller_id: 'seller_1' } as any) // Transaction belongs to seller
        .mockResolvedValueOnce(transaction as any) // Get transaction for admin notification
        .mockResolvedValueOnce(mockUpdatedDispute as any); // Return updated dispute

      vi.mocked(db.run).mockResolvedValue({ success: true } as any);

      const result = await service.sellerResponse(
        'dsp_123',
        'seller_1',
        'Item was shipped on time'
      );

      expect(result).toBeDefined();
      expect(result.status).toBe(DisputeStatus.SELLER_RESPONDING);
    });

    it('should throw NotFoundError when dispute does not exist', async () => {
      vi.mocked(db.first).mockResolvedValueOnce(null);

      await expect(
        service.sellerResponse('dsp_123', 'seller_1', 'Response')
      ).rejects.toThrow(NotFoundError);
    });

    it('should throw ValidationError when dispute does not belong to seller', async () => {
      const dispute = {
        id: 'dsp_123',
        transaction_id: 'tx_123',
      };

      const transaction = {
        id: 'tx_123',
        seller_id: 'different_seller',
      };

      vi.mocked(db.first).mockResolvedValueOnce(dispute as any);
      vi.mocked(db.first).mockResolvedValueOnce(transaction as any);

      await expect(
        service.sellerResponse('dsp_123', 'seller_1', 'Response')
      ).rejects.toThrow(ValidationError);
    });

    it('should throw ConflictError when seller already responded', async () => {
      const dispute = {
        id: 'dsp_123',
        transaction_id: 'tx_123',
        status: DisputeStatus.SELLER_RESPONDING,
        seller_response: 'Already responded',
      };

      const transaction = {
        id: 'tx_123',
        seller_id: 'seller_1',
      };

      vi.mocked(db.first).mockResolvedValueOnce(dispute as any);
      vi.mocked(db.first).mockResolvedValueOnce(transaction as any);

      await expect(
        service.sellerResponse('dsp_123', 'seller_1', 'Response')
      ).rejects.toThrow(ConflictError);
    });
  });

  describe('resolveDispute', () => {
    it('should successfully resolve dispute in buyer favor', async () => {
      const dispute = {
        id: 'dsp_123',
        transaction_id: 'tx_123',
        status: DisputeStatus.SELLER_RESPONDING,
        reason: DisputeReason.NOT_RECEIVED,
        buyer_email: 'buyer@example.com',
      };

      const transaction = {
        id: 'tx_123',
        status: 'disputed',
        amount: 100000,
        seller_id: 'seller_1',
      };

      const refundedTransaction = {
        id: 'tx_123',
        status: 'refunded',
        amount: 100000,
        seller_id: 'seller_1',
      };

      const mockResolvedDispute = {
        id: 'dsp_123',
        transaction_id: 'tx_123',
        status: DisputeStatus.RESOLVED,
        resolution: 'Buyer provided valid tracking showing non-delivery',
        resolved_for: 'buyer',
        buyer_email: 'buyer@example.com',
      };

      vi.mocked(db.first)
        .mockResolvedValueOnce(dispute as any) // Get dispute
        .mockResolvedValueOnce(transaction as any) // Get transaction
        .mockResolvedValueOnce({ email: 'seller@example.com' } as any) // Get seller email
        .mockResolvedValueOnce(mockResolvedDispute as any); // Get updated dispute (final call)

      vi.mocked(engine.resolveDispute).mockResolvedValue(refundedTransaction as any);
      vi.mocked(engine.approveRefund).mockResolvedValue(refundedTransaction as any);
      vi.mocked(engine.getTransaction).mockResolvedValue(refundedTransaction as any);
      vi.mocked(ledger.recordRefund).mockResolvedValue({} as any);
      vi.mocked(db.run).mockResolvedValue({ success: true } as any);

      const result = await service.resolveDispute(
        'dsp_123',
        'Buyer provided valid tracking showing non-delivery',
        'buyer',
        'admin_1'
      );

      expect(result).toBeDefined();
      expect(result.dispute.status).toBe(DisputeStatus.RESOLVED);
      expect(result.transaction.status).toBe('refunded');
      expect(engine.resolveDispute).toHaveBeenCalled();
      expect(engine.approveRefund).toHaveBeenCalled();
      expect(ledger.recordRefund).toHaveBeenCalled();
    });

    it('should successfully resolve dispute in seller favor', async () => {
      const dispute = {
        id: 'dsp_123',
        transaction_id: 'tx_123',
        status: DisputeStatus.SELLER_RESPONDING,
        buyer_email: 'buyer@example.com',
      };

      const transaction = {
        id: 'tx_123',
        status: 'disputed',
        amount: 100000,
        seller_id: 'seller_1',
      };

      const releasedTransaction = {
        id: 'tx_123',
        status: 'released',
        amount: 100000,
        seller_id: 'seller_1',
      };

      const mockResolvedDispute = {
        id: 'dsp_123',
        transaction_id: 'tx_123',
        status: DisputeStatus.RESOLVED,
        resolution: 'Seller provided proof of delivery',
        resolved_for: 'seller',
        buyer_email: 'buyer@example.com',
      };

      vi.mocked(db.first)
        .mockResolvedValueOnce(dispute as any) // Get dispute
        .mockResolvedValueOnce(transaction as any) // Get transaction
        .mockResolvedValueOnce({ email: 'seller@example.com' } as any) // Get seller email
        .mockResolvedValueOnce(mockResolvedDispute as any); // Get updated dispute

      vi.mocked(engine.resolveDispute).mockResolvedValue(releasedTransaction as any);
      vi.mocked(engine.finalizeRelease).mockResolvedValue(releasedTransaction as any);
      vi.mocked(engine.getTransaction).mockResolvedValue(releasedTransaction as any);
      vi.mocked(db.run).mockResolvedValue({ success: true } as any);

      const result = await service.resolveDispute(
        'dsp_123',
        'Seller provided proof of delivery',
        'seller',
        'admin_1'
      );

      expect(result).toBeDefined();
      expect(result.dispute.status).toBe(DisputeStatus.RESOLVED);
      expect(result.transaction.status).toBe('released');
      expect(engine.resolveDispute).toHaveBeenCalled();
      expect(engine.finalizeRelease).toHaveBeenCalled();
    });

    it('should throw NotFoundError when dispute does not exist', async () => {
      vi.mocked(db.first).mockResolvedValueOnce(null);

      await expect(
        service.resolveDispute('dsp_123', 'Resolution', 'buyer', 'admin_1')
      ).rejects.toThrow(NotFoundError);
    });

    it('should throw ConflictError when dispute is not in correct status', async () => {
      const dispute = {
        id: 'dsp_123',
        transaction_id: 'tx_123',
        status: DisputeStatus.RESOLVED,
      };

      vi.mocked(db.first).mockResolvedValueOnce(dispute as any);

      await expect(
        service.resolveDispute('dsp_123', 'Resolution', 'buyer', 'admin_1')
      ).rejects.toThrow(ConflictError);
    });
  });
});
