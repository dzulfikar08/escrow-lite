/**
 * Evidence Service Unit Tests
 *
 * Tests for evidence file upload, validation, and management
 * using Cloudflare R2 for storage
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { EvidenceService } from '@/services/disputes/evidence';
import { R2Storage } from '@/lib/storage';
import { ValidationError, NotFoundError } from '@/lib/errors';

describe('EvidenceService - File Validation', () => {
  let evidenceService: EvidenceService;
  let mockDb: any;
  let mockStorage: any;

  beforeEach(() => {
    mockDb = {
      prepare: vi.fn().mockReturnThis(),
      bind: vi.fn().mockReturnThis(),
      first: vi.fn(),
      run: vi.fn(),
      all: vi.fn(),
    };

    mockStorage = {
      uploadFile: vi.fn(),
      deleteFile: vi.fn(),
      fileExists: vi.fn(),
      generateDownloadUrl: vi.fn(),
      generateUploadUrl: vi.fn(),
    };

    evidenceService = new EvidenceService(mockDb, mockStorage);
  });

  describe('File size validation', () => {
    it('should reject files larger than 10MB', async () => {
      const largeFile = createMockFile(11 * 1024 * 1024, 'test.jpg', 'image/jpeg');

      await expect(
        evidenceService.uploadEvidence('dsp_123', largeFile, 'buyer')
      ).rejects.toThrow(ValidationError);
      await expect(
        evidenceService.uploadEvidence('dsp_123', largeFile, 'buyer')
      ).rejects.toThrow('File size exceeds 10MB limit');
    });

    it('should accept files exactly 10MB', async () => {
      const validFile = createMockFile(10 * 1024 * 1024, 'test.jpg', 'image/jpeg');
      mockDb.first.mockResolvedValueOnce({ id: 'dsp_123', status: 'open' });
      mockStorage.uploadFile.mockResolvedValueOnce(undefined);
      mockDb.run.mockResolvedValueOnce({ success: true });

      await expect(
        evidenceService.uploadEvidence('dsp_123', validFile, 'buyer')
      ).resolves.toBeDefined();
    });

    it('should accept small files', async () => {
      const smallFile = createMockFile(1024, 'test.jpg', 'image/jpeg');
      mockDb.first.mockResolvedValueOnce({ id: 'dsp_123', status: 'open' });
      mockStorage.uploadFile.mockResolvedValueOnce(undefined);
      mockDb.run.mockResolvedValueOnce({ success: true });

      await expect(
        evidenceService.uploadEvidence('dsp_123', smallFile, 'buyer')
      ).resolves.toBeDefined();
    });
  });

  describe('File type validation', () => {
    const allowedTypes = [
      { name: 'test.jpg', type: 'image/jpeg', shouldPass: true },
      { name: 'test.jpeg', type: 'image/jpeg', shouldPass: true },
      { name: 'test.png', type: 'image/png', shouldPass: true },
      { name: 'test.gif', type: 'image/gif', shouldPass: true },
      { name: 'test.pdf', type: 'application/pdf', shouldPass: true },
      { name: 'test.doc', type: 'application/msword', shouldPass: true },
      { name: 'test.docx', type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', shouldPass: true },
      { name: 'test.txt', type: 'text/plain', shouldPass: false },
      { name: 'test.exe', type: 'application/x-msdownload', shouldPass: false },
      { name: 'test.zip', type: 'application/zip', shouldPass: false },
      { name: 'test.mp4', type: 'video/mp4', shouldPass: false },
    ];

    allowedTypes.forEach(({ name, type, shouldPass }) => {
      it(`should ${shouldPass ? 'accept' : 'reject'} ${name} (${type})`, async () => {
        const file = createMockFile(1024, name, type);

        if (shouldPass) {
          mockDb.first.mockResolvedValueOnce({ id: 'dsp_123', status: 'open' });
          mockStorage.uploadFile.mockResolvedValueOnce(undefined);
          mockDb.run.mockResolvedValueOnce({ success: true });

          await expect(
            evidenceService.uploadEvidence('dsp_123', file, 'buyer')
          ).resolves.toBeDefined();
        } else {
          await expect(
            evidenceService.uploadEvidence('dsp_123', file, 'buyer')
          ).rejects.toThrow(ValidationError);
          await expect(
            evidenceService.uploadEvidence('dsp_123', file, 'buyer')
          ).rejects.toThrow('File type not allowed');
        }
      });
    });
  });

  describe('Content-Type validation', () => {
    it('should validate content-type matches file extension', async () => {
      const file = createMockFile(1024, 'test.jpg', 'application/pdf');

      await expect(
        evidenceService.uploadEvidence('dsp_123', file, 'buyer')
      ).rejects.toThrow(ValidationError);
      await expect(
        evidenceService.uploadEvidence('dsp_123', file, 'buyer')
      ).rejects.toThrow('Content-Type "application/pdf" does not match file extension "jpg"');
    });

    it('should accept correct content-type for images', async () => {
      const file = createMockFile(1024, 'test.png', 'image/png');
      mockDb.first.mockResolvedValueOnce({ id: 'dsp_123', status: 'open' });
      mockStorage.uploadFile.mockResolvedValueOnce(undefined);
      mockDb.run.mockResolvedValueOnce({ success: true });

      await expect(
        evidenceService.uploadEvidence('dsp_123', file, 'buyer')
      ).resolves.toBeDefined();
    });
  });
});

describe('EvidenceService - Upload Operations', () => {
  let evidenceService: EvidenceService;
  let mockDb: any;
  let mockStorage: any;

  beforeEach(() => {
    mockDb = {
      prepare: vi.fn().mockReturnThis(),
      bind: vi.fn().mockReturnThis(),
      first: vi.fn(),
      run: vi.fn(),
      all: vi.fn(),
    };

    mockStorage = {
      uploadFile: vi.fn(),
      deleteFile: vi.fn(),
      fileExists: vi.fn(),
      generateDownloadUrl: vi.fn(),
      generateUploadUrl: vi.fn(),
    };

    evidenceService = new EvidenceService(mockDb, mockStorage);
  });

  it('should upload file to R2 with correct key format', async () => {
    const file = createMockFile(1024, 'receipt.jpg', 'image/jpeg');
    mockDb.first.mockResolvedValueOnce({ id: 'dsp_123', status: 'open' });
    mockStorage.uploadFile.mockResolvedValueOnce(undefined);
    mockDb.run.mockResolvedValueOnce({ success: true });

    await evidenceService.uploadEvidence('dsp_123', file, 'buyer');

    expect(mockStorage.uploadFile).toHaveBeenCalledWith(
      expect.stringMatching(/^disputes\/dsp_123\/evd_[a-f0-9-]+\/receipt\.jpg$/),
      file,
      expect.objectContaining({
        disputeId: 'dsp_123',
        originalFilename: 'receipt.jpg',
        uploadedBy: 'buyer',
        contentType: 'image/jpeg',
      })
    );
  });

  it('should create evidence record in database', async () => {
    const file = createMockFile(1024, 'receipt.jpg', 'image/jpeg');
    mockDb.first.mockResolvedValueOnce({ id: 'dsp_123', status: 'open' });
    mockStorage.uploadFile.mockResolvedValueOnce(undefined);
    mockDb.run.mockResolvedValueOnce({ success: true });

    const evidence = await evidenceService.uploadEvidence('dsp_123', file, 'buyer');

    expect(mockDb.run).toHaveBeenCalled();
    expect(evidence).toHaveProperty('id');
    expect(evidence).toHaveProperty('dispute_id', 'dsp_123');
    expect(evidence).toHaveProperty('file_name', 'receipt.jpg');
    expect(evidence).toHaveProperty('uploaded_by', 'buyer');
  });

  it('should update dispute evidence_count', async () => {
    const file = createMockFile(1024, 'receipt.jpg', 'image/jpeg');
    mockDb.first
      .mockResolvedValueOnce({ id: 'dsp_123', status: 'open' })
      .mockResolvedValueOnce({ count: 5 });
    mockStorage.uploadFile.mockResolvedValueOnce(undefined);
    mockDb.run.mockResolvedValueOnce({ success: true });

    await evidenceService.uploadEvidence('dsp_123', file, 'buyer');

    // Should be called twice: once for insert, once for update
    expect(mockDb.run).toHaveBeenCalledTimes(2);
  });

  it('should validate dispute exists before upload', async () => {
    const file = createMockFile(1024, 'receipt.jpg', 'image/jpeg');
    mockDb.first.mockResolvedValueOnce(null);

    await expect(
      evidenceService.uploadEvidence('dsp_123', file, 'buyer')
    ).rejects.toThrow(NotFoundError);
    await expect(
      evidenceService.uploadEvidence('dsp_123', file, 'buyer')
    ).rejects.toThrow('Dispute not found');
  });

  it('should validate uploaded_by is valid role', async () => {
    const file = createMockFile(1024, 'receipt.jpg', 'image/jpeg');

    await expect(
      evidenceService.uploadEvidence('dsp_123', file, 'admin' as any)
    ).rejects.toThrow(ValidationError);
    await expect(
      evidenceService.uploadEvidence('dsp_123', file, 'admin' as any)
    ).rejects.toThrow('Invalid uploader role');
  });
});

describe('EvidenceService - Download Operations', () => {
  let evidenceService: EvidenceService;
  let mockDb: any;
  let mockStorage: any;

  beforeEach(() => {
    mockDb = {
      prepare: vi.fn().mockReturnThis(),
      bind: vi.fn().mockReturnThis(),
      first: vi.fn(),
      run: vi.fn(),
      all: vi.fn(),
    };

    mockStorage = {
      uploadFile: vi.fn(),
      deleteFile: vi.fn(),
      fileExists: vi.fn(),
      generateDownloadUrl: vi.fn(),
      generateUploadUrl: vi.fn(),
    };

    evidenceService = new EvidenceService(mockDb, mockStorage);
  });

  it('should generate presigned download URL', async () => {
    mockDb.first.mockResolvedValueOnce({
      id: 'evd_123',
      dispute_id: 'dsp_123',
      file_url: 'disputes/dsp_123/abc-123/receipt.jpg',
    });
    mockStorage.generateDownloadUrl.mockResolvedValueOnce('https://presigned-url');

    const url = await evidenceService.getDownloadUrl('evd_123');

    expect(url).toBe('https://presigned-url');
    expect(mockStorage.generateDownloadUrl).toHaveBeenCalledWith('disputes/dsp_123/abc-123/receipt.jpg', 3600);
  });

  it('should set download URL expiry to 1 hour', async () => {
    mockDb.first.mockResolvedValueOnce({
      id: 'evd_123',
      file_url: 'disputes/dsp_123/abc-123/receipt.jpg',
    });
    mockStorage.generateDownloadUrl.mockResolvedValueOnce('https://presigned-url');

    await evidenceService.getDownloadUrl('evd_123');

    expect(mockStorage.generateDownloadUrl).toHaveBeenCalledWith(
      'disputes/dsp_123/abc-123/receipt.jpg',
      3600 // 1 hour in seconds
    );
  });

  it('should throw NotFoundError if evidence not found', async () => {
    mockDb.first.mockResolvedValueOnce(null);

    await expect(
      evidenceService.getDownloadUrl('evd_123')
    ).rejects.toThrow(NotFoundError);
    await expect(
      evidenceService.getDownloadUrl('evd_123')
    ).rejects.toThrow('Evidence not found');
  });
});

describe('EvidenceService - List Operations', () => {
  let evidenceService: EvidenceService;
  let mockDb: any;
  let mockStorage: any;

  beforeEach(() => {
    mockDb = {
      prepare: vi.fn().mockReturnThis(),
      bind: vi.fn().mockReturnThis(),
      first: vi.fn(),
      run: vi.fn(),
      all: vi.fn(),
    };

    mockStorage = {
      uploadFile: vi.fn(),
      deleteFile: vi.fn(),
      fileExists: vi.fn(),
      generateDownloadUrl: vi.fn(),
      generateUploadUrl: vi.fn(),
    };

    evidenceService = new EvidenceService(mockDb, mockStorage);
  });

  it('should list all evidence for dispute', async () => {
    const mockEvidence = [
      { id: 'evd_1', file_name: 'receipt.jpg', uploaded_by: 'buyer' },
      { id: 'evd_2', file_name: 'photo.png', uploaded_by: 'seller' },
    ];
    mockDb.all.mockResolvedValueOnce({ results: mockEvidence });

    const evidence = await evidenceService.getDisputeEvidence('dsp_123');

    expect(evidence).toHaveLength(2);
    expect(evidence[0].file_name).toBe('receipt.jpg');
    expect(evidence[1].file_name).toBe('photo.png');
  });

  it('should return empty array if no evidence', async () => {
    mockDb.all.mockResolvedValueOnce({ results: [] });

    const evidence = await evidenceService.getDisputeEvidence('dsp_123');

    expect(evidence).toEqual([]);
  });
});

describe('EvidenceService - Delete Operations', () => {
  let evidenceService: EvidenceService;
  let mockDb: any;
  let mockStorage: any;

  beforeEach(() => {
    mockDb = {
      prepare: vi.fn().mockReturnThis(),
      bind: vi.fn().mockReturnThis(),
      first: vi.fn(),
      run: vi.fn(),
      all: vi.fn(),
    };

    mockStorage = {
      uploadFile: vi.fn(),
      deleteFile: vi.fn(),
      fileExists: vi.fn(),
      generateDownloadUrl: vi.fn(),
      generateUploadUrl: vi.fn(),
    };

    evidenceService = new EvidenceService(mockDb, mockStorage);
  });

  it('should delete file from R2 and database', async () => {
    mockDb.first
      .mockResolvedValueOnce({
        id: 'evd_123',
        dispute_id: 'dsp_123',
        file_url: 'disputes/dsp_123/abc-123/receipt.jpg',
      })
      .mockResolvedValueOnce({ count: 2 });
    mockStorage.deleteFile.mockResolvedValueOnce(undefined);
    mockDb.run.mockResolvedValueOnce({ success: true });

    await evidenceService.deleteEvidence('evd_123');

    expect(mockStorage.deleteFile).toHaveBeenCalledWith('disputes/dsp_123/abc-123/receipt.jpg');
    expect(mockDb.run).toHaveBeenCalled();
  });

  it('should update dispute evidence_count after deletion', async () => {
    mockDb.first
      .mockResolvedValueOnce({
        id: 'evd_123',
        dispute_id: 'dsp_123',
        file_url: 'disputes/dsp_123/abc-123/receipt.jpg',
      })
      .mockResolvedValueOnce({ count: 2 });
    mockStorage.deleteFile.mockResolvedValueOnce(undefined);
    mockDb.run.mockResolvedValueOnce({ success: true });

    await evidenceService.deleteEvidence('evd_123');

    // Should be called twice: once for delete, once for update
    expect(mockDb.run).toHaveBeenCalledTimes(2);
  });

  it('should throw NotFoundError if evidence not found', async () => {
    mockDb.first.mockResolvedValueOnce(null);

    await expect(
      evidenceService.deleteEvidence('evd_123')
    ).rejects.toThrow(NotFoundError);
  });
});

describe('EvidenceService - Presigned URL Generation', () => {
  let evidenceService: EvidenceService;
  let mockDb: any;
  let mockStorage: any;

  beforeEach(() => {
    mockDb = {
      prepare: vi.fn().mockReturnThis(),
      bind: vi.fn().mockReturnThis(),
      first: vi.fn(),
      run: vi.fn(),
      all: vi.fn(),
    };

    mockStorage = {
      uploadFile: vi.fn(),
      deleteFile: vi.fn(),
      fileExists: vi.fn(),
      generateDownloadUrl: vi.fn(),
      generateUploadUrl: vi.fn(),
    };

    evidenceService = new EvidenceService(mockDb, mockStorage);
  });

  it('should generate presigned upload URL for client-side upload', async () => {
    mockStorage.generateUploadUrl.mockResolvedValueOnce('https://presigned-upload-url');
    mockDb.first.mockResolvedValueOnce({ id: 'dsp_123', status: 'open' });

    const result = await evidenceService.generateUploadUrl('dsp_123', 'receipt.jpg', 'image/jpeg');

    expect(result.uploadUrl).toBe('https://presigned-upload-url');
    expect(result.key).toMatch(/^disputes\/dsp_123\/evd_[a-f0-9-]+\/receipt\.jpg$/);
  });

  it('should set upload URL expiry to 15 minutes', async () => {
    mockStorage.generateUploadUrl.mockResolvedValueOnce('https://presigned-upload-url');
    mockDb.first.mockResolvedValueOnce({ id: 'dsp_123', status: 'open' });

    await evidenceService.generateUploadUrl('dsp_123', 'receipt.jpg', 'image/jpeg');

    expect(mockStorage.generateUploadUrl).toHaveBeenCalledWith(
      expect.anything(),
      'image/jpeg',
      900 // 15 minutes in seconds
    );
  });

  it('should validate dispute exists before generating URL', async () => {
    mockDb.first.mockResolvedValueOnce(null);

    await expect(
      evidenceService.generateUploadUrl('dsp_123', 'receipt.jpg', 'image/jpeg')
    ).rejects.toThrow(NotFoundError);
  });
});

// Helper function to create mock File objects
function createMockFile(size: number, name: string, type: string): File {
  const buffer = new ArrayBuffer(size);
  const file = new File([buffer], name, { type });
  Object.defineProperty(file, 'size', { value: size });
  return file;
}
