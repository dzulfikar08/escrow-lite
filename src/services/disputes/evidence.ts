/**
 * Evidence Service
 *
 * Manages evidence files for disputes including:
 * - File upload validation (size, type, content-type)
 * - Storage in Cloudflare R2
 * - Database records
 * - Presigned URL generation
 * - Evidence listing and deletion
 */

import type { D1Database } from '@cloudflare/workers-types';
import { R2Storage } from '@/lib/storage';
import { ValidationError, NotFoundError } from '@/lib/errors';
import * as Queries from '@/db/queries/disputes';

/**
 * Allowed file extensions for evidence
 */
const ALLOWED_EXTENSIONS = ['jpg', 'jpeg', 'png', 'gif', 'pdf', 'doc', 'docx'];

/**
 * Maximum file size in bytes (10MB)
 */
const MAX_FILE_SIZE = 10 * 1024 * 1024;

/**
 * MIME type mapping for file extensions
 */
const MIME_TYPE_MAP: Record<string, string> = {
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  png: 'image/png',
  gif: 'image/gif',
  pdf: 'application/pdf',
  doc: 'application/msword',
  docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
};

/**
 * Evidence entity
 */
export interface Evidence {
  id: string;
  dispute_id: string;
  file_name: string;
  file_url: string;
  file_type: string;
  file_size: number;
  uploaded_by: 'buyer' | 'seller';
  uploaded_at: string;
}

/**
 * Result from upload operation
 */
export interface EvidenceUploadResult {
  evidence: Evidence;
  downloadUrl: string;
}

/**
 * Evidence Service class
 */
export class EvidenceService {
  constructor(
    private db: D1Database,
    private storage: R2Storage
  ) {}

  /**
   * Upload evidence file for a dispute
   *
   * @param disputeId - The dispute ID
   * @param file - The file to upload
   * @param uploadedBy - Who is uploading (buyer, seller, admin)
   * @returns Evidence record
   * @throws ValidationError if file validation fails
   * @throws NotFoundError if dispute doesn't exist
   */
  async uploadEvidence(
    disputeId: string,
    file: File,
    uploadedBy: 'buyer' | 'seller' | 'admin'
  ): Promise<Evidence> {
    // 1. Validate file
    await this.validateFile(file);

    // 2. Validate uploader role
    if (!['buyer', 'seller'].includes(uploadedBy)) {
      throw new ValidationError('Invalid uploader role');
    }

    // 3. Check dispute exists
    const dispute = await this.db
      .prepare(Queries.GET_DISPUTE_BY_ID)
      .bind(disputeId)
      .first();

    if (!dispute) {
      throw new NotFoundError('Dispute not found');
    }

    // 4. Generate evidence ID and R2 key
    const evidenceId = `evd_${crypto.randomUUID()}`;
    const key = R2Storage.generateEvidenceKey(disputeId, evidenceId, file.name);

    // 5. Upload file to R2
    await this.storage.uploadFile(key, file, {
      disputeId,
      originalFilename: file.name,
      uploadedBy,
      contentType: file.type,
    });

    // 6. Create evidence record in database
    const now = new Date().toISOString();

    await this.db
      .prepare(Queries.ADD_DISPUTE_EVIDENCE)
      .bind(
        evidenceId,
        disputeId,
        file.name,
        key,  // stored as file_url
        file.type,
        uploadedBy,
        now
      )
      .run();

    // 7. Update dispute evidence_count
    await this.updateEvidenceCount(disputeId);

    // 8. Return evidence record
    return {
      id: evidenceId,
      dispute_id: disputeId,
      file_name: file.name,
      file_url: key,
      file_type: file.type,
      file_size: file.size,
      uploaded_by: uploadedBy as 'buyer' | 'seller', // admin not allowed by schema
      uploaded_at: now,
    };
  }

  /**
   * Generate presigned upload URL for client-side uploads
   *
   * @param disputeId - The dispute ID
   * @param filename - The filename to be uploaded
   * @param contentType - The MIME type of the file
   * @returns Upload URL and storage key
   * @throws ValidationError if file validation fails
   * @throws NotFoundError if dispute doesn't exist
   */
  async generateUploadUrl(
    disputeId: string,
    filename: string,
    contentType: string
  ): Promise<{ uploadUrl: string; key: string }> {
    // 1. Validate file extension
    const extension = filename.split('.').pop()?.toLowerCase();
    if (!extension || !ALLOWED_EXTENSIONS.includes(extension)) {
      throw new ValidationError('File type not allowed');
    }

    // 2. Validate content-type matches extension
    const expectedContentType = MIME_TYPE_MAP[extension];
    if (contentType !== expectedContentType) {
      throw new ValidationError('Content-Type does not match file extension');
    }

    // 3. Check dispute exists
    const dispute = await this.db
      .prepare(Queries.GET_DISPUTE_BY_ID)
      .bind(disputeId)
      .first();

    if (!dispute) {
      throw new NotFoundError('Dispute not found');
    }

    // 4. Generate evidence ID and R2 key
    const evidenceId = `evd_${crypto.randomUUID()}`;
    const key = R2Storage.generateEvidenceKey(disputeId, evidenceId, filename);

    // 5. Generate presigned URL (15 minutes = 900 seconds)
    const uploadUrl = await this.storage.generateUploadUrl(key, contentType, 900);

    return {
      uploadUrl,
      key,
    };
  }

  /**
   * Get all evidence for a dispute
   *
   * @param disputeId - The dispute ID
   * @returns Array of evidence records
   */
  async getDisputeEvidence(disputeId: string): Promise<Evidence[]> {
    const result = await this.db
      .prepare(Queries.GET_DISPUTE_EVIDENCE)
      .bind(disputeId)
      .all();

    return (result.results || []).map((record: Record<string, unknown>) => ({
      id: record.id as string,
      dispute_id: record.dispute_id as string,
      file_name: record.file_name as string,
      file_url: record.file_url as string,
      file_type: record.file_type as string,
      file_size: (record.file_size as number | undefined) || 0,
      uploaded_by: record.uploaded_by as 'buyer' | 'seller',
      uploaded_at: record.uploaded_at as string,
    }));
  }

  /**
   * Generate presigned download URL for evidence
   *
   * @param evidenceId - The evidence ID
   * @returns Presigned download URL (valid for 1 hour)
   * @throws NotFoundError if evidence doesn't exist
   */
  async getDownloadUrl(evidenceId: string): Promise<string> {
    // 1. Get evidence record
    const evidence = await this.db
      .prepare('SELECT id, file_url FROM dispute_evidence WHERE id = ?')
      .bind(evidenceId)
      .first<{ id: string; file_url: string }>();

    if (!evidence) {
      throw new NotFoundError('Evidence not found');
    }

    // 2. Generate presigned download URL (1 hour = 3600 seconds)
    return this.storage.generateDownloadUrl(evidence.file_url, 3600);
  }

  /**
   * Delete evidence
   *
   * @param evidenceId - The evidence ID
   * @throws NotFoundError if evidence doesn't exist
   */
  async deleteEvidence(evidenceId: string): Promise<void> {
    // 1. Get evidence record
    const evidence = await this.db
      .prepare('SELECT id, dispute_id, file_url FROM dispute_evidence WHERE id = ?')
      .bind(evidenceId)
      .first<{ id: string; dispute_id: string; file_url: string }>();

    if (!evidence) {
      throw new NotFoundError('Evidence not found');
    }

    // 2. Delete file from R2
    try {
      await this.storage.deleteFile(evidence.file_url);
    } catch (error) {
      console.error('Error deleting file from R2:', error);
      // Continue with database deletion even if R2 deletion fails
    }

    // 3. Delete evidence record from database
    await this.db
      .prepare('DELETE FROM dispute_evidence WHERE id = ?')
      .bind(evidenceId)
      .run();

    // 4. Update dispute evidence_count
    await this.updateEvidenceCount(evidence.dispute_id);
  }

  /**
   * Validate file before upload
   *
   * @param file - The file to validate
   * @throws ValidationError if validation fails
   */
  private async validateFile(file: File): Promise<void> {
    // 1. Check file size
    if (file.size > MAX_FILE_SIZE) {
      throw new ValidationError(`File size exceeds ${MAX_FILE_SIZE / 1024 / 1024}MB limit`);
    }

    if (file.size === 0) {
      throw new ValidationError('File is empty');
    }

    // 2. Check file extension
    const extension = file.name.split('.').pop()?.toLowerCase();
    if (!extension || !ALLOWED_EXTENSIONS.includes(extension)) {
      throw new ValidationError(
        `File type not allowed. Allowed types: ${ALLOWED_EXTENSIONS.join(', ')}`
      );
    }

    // 3. Validate content-type matches extension
    const expectedContentType = MIME_TYPE_MAP[extension];
    if (file.type !== expectedContentType) {
      throw new ValidationError(
        `Content-Type "${file.type}" does not match file extension "${extension}"`
      );
    }
  }

  /**
   * Update evidence count for a dispute
   *
   * @param disputeId - The dispute ID
   */
  private async updateEvidenceCount(disputeId: string): Promise<void> {
    await this.db
      .prepare(Queries.UPDATE_EVIDENCE_COUNT)
      .bind(disputeId, new Date().toISOString(), disputeId)
      .run();
  }
}
