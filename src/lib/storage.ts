/**
 * Cloudflare R2 Storage Wrapper
 *
 * Provides a clean interface for interacting with Cloudflare R2 buckets.
 * Handles file uploads, downloads, and presigned URL generation.
 */

import type { R2Bucket } from '@cloudflare/workers-types';

export interface UploadMetadata {
  disputeId: string;
  originalFilename: string;
  uploadedBy: 'buyer' | 'seller' | 'admin';
  contentType: string;
}

/**
 * R2Storage class for managing files in Cloudflare R2
 */
export class R2Storage {
  constructor(private bucket: R2Bucket) {}

  /**
   * Generate a presigned upload URL for client-side uploads
   *
   * @param key - The storage key for the file
   * @param contentType - MIME type of the file
   * @param expiresIn - URL expiry time in seconds (default: 900 = 15 minutes)
   * @returns Presigned URL for uploading
   */
  async generateUploadUrl(
    key: string,
    contentType: string,
    expiresIn: number = 900
  ): Promise<string> {
    // In a real implementation, this would use R2's presigned URL API
    // For Cloudflare Workers, we need to use a different approach
    // since R2 doesn't support presigned URLs directly in Workers
    //
    // Options:
    // 1. Use Cloudflare API to generate presigned URL (requires API token)
    // 2. Implement server-side upload (simpler for this MVP)
    // 3. Use Worker's own endpoint as proxy
    //
    // For this implementation, we'll use a simplified approach:
    // Return a special URL that our API endpoint will recognize

    const uploadUrl = `${key}?upload=${Date.now() + expiresIn * 1000}&type=${encodeURIComponent(contentType)}`;

    return uploadUrl;
  }

  /**
   * Upload a file from a Request object
   *
   * @param key - The storage key for the file
   * @param file - File object to upload
   * @param metadata - Optional metadata to attach to the file
   * @returns Promise that resolves when upload is complete
   */
  async uploadFile(
    key: string,
    file: File,
    metadata?: UploadMetadata
  ): Promise<void> {
    try {
      const arrayBuffer = await file.arrayBuffer();

      // Prepare metadata for R2
      const customMetadata: Record<string, string> = {
        originalFilename: file.name,
        contentType: file.type,
        uploadedAt: new Date().toISOString(),
        ...(metadata && {
          disputeId: metadata.disputeId,
          uploadedBy: metadata.uploadedBy,
        }),
      };

      // Upload to R2
      await this.bucket.put(key, arrayBuffer, {
        httpMetadata: {
          contentType: file.type,
        },
        customMetadata,
      });
    } catch (error) {
      console.error('Error uploading file to R2:', error);
      throw new Error(`Failed to upload file: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Generate a presigned download URL
   *
   * @param key - The storage key for the file
   * @param expiresIn - URL expiry time in seconds (default: 3600 = 1 hour)
   * @returns Presigned URL for downloading
   */
  async generateDownloadUrl(key: string, expiresIn: number = 3600): Promise<string> {
    // Similar to upload URLs, R2 in Workers doesn't support presigned URLs directly
    // We'll implement a simplified approach using a custom endpoint

    const downloadUrl = `${key}?download=${Date.now() + expiresIn * 1000}`;

    return downloadUrl;
  }

  /**
   * Delete a file from R2
   *
   * @param key - The storage key for the file
   * @returns Promise that resolves when deletion is complete
   */
  async deleteFile(key: string): Promise<void> {
    try {
      await this.bucket.delete(key);
    } catch (error) {
      console.error('Error deleting file from R2:', error);
      throw new Error(`Failed to delete file: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Check if a file exists in R2
   *
   * @param key - The storage key for the file
   * @returns True if file exists, false otherwise
   */
  async fileExists(key: string): Promise<boolean> {
    try {
      const object = await this.bucket.head(key);
      return object !== null;
    } catch (error) {
      console.error('Error checking file existence in R2:', error);
      return false;
    }
  }

  /**
   * Get file metadata without downloading the file
   *
   * @param key - The storage key for the file
   * @returns File metadata or null if file doesn't exist
   */
  async getFileMetadata(key: string): Promise<{
    size: number;
    contentType: string;
    uploadedAt: string;
    customMetadata?: Record<string, string>;
  } | null> {
    try {
      const object = await this.bucket.head(key);

      if (!object) {
        return null;
      }

      return {
        size: object.size,
        contentType: object.httpMetadata?.contentType || 'application/octet-stream',
        uploadedAt: object.uploaded?.toISOString() || new Date().toISOString(),
        customMetadata: object.customMetadata,
      };
    } catch (error) {
      console.error('Error getting file metadata from R2:', error);
      return null;
    }
  }

  /**
   * Download a file from R2
   *
   * @param key - The storage key for the file
   * @returns File content as ArrayBuffer
   */
  async downloadFile(key: string): Promise<ArrayBuffer> {
    try {
      const object = await this.bucket.get(key);

      if (!object) {
        throw new Error('File not found');
      }

      return await object.arrayBuffer();
    } catch (error) {
      console.error('Error downloading file from R2:', error);
      throw new Error(`Failed to download file: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Generate a unique storage key for evidence files
   *
   * Format: disputes/{disputeId}/{evidenceId}/{filename}
   *
   * @param disputeId - The dispute ID
   * @param evidenceId - The evidence ID (UUID)
   * @param filename - Original filename
   * @returns Storage key
   */
  static generateEvidenceKey(disputeId: string, evidenceId: string, filename: string): string {
    // Sanitize filename to prevent path traversal
    const sanitizedFilename = filename
      .replace(/[^a-zA-Z0-9._-]/g, '_')
      .replace(/_{2,}/g, '_')
      .substring(0, 255);

    return `disputes/${disputeId}/${evidenceId}/${sanitizedFilename}`;
  }

  /**
   * Parse an evidence key to extract components
   *
   * @param key - The storage key
   * @returns Parsed components or null if invalid
   */
  static parseEvidenceKey(key: string): {
    disputeId: string;
    evidenceId: string;
    filename: string;
  } | null {
    const match = key.match(/^disputes\/([^/]+)\/([^/]+)\/(.+)$/);

    if (!match) {
      return null;
    }

    return {
      disputeId: match[1],
      evidenceId: match[2],
      filename: match[3],
    };
  }
}
