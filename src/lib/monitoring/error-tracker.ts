/**
 * Error Tracking Service
 *
 * Captures, stores, and retrieves application errors for monitoring and analysis.
 * Integrates with D1 database for persistent storage and querying.
 */

import type { D1Database } from '@cloudflare/workers-types';
import type { AppError } from '@/lib/errors';

/**
 * Error context information
 */
export interface ErrorContext {
  userId?: string;
  requestId?: string;
  endpoint?: string;
  method?: string;
  userAgent?: string;
  ip?: string;
  metadata?: Record<string, any>;
}

/**
 * Error log entry
 */
export interface ErrorLog {
  id: string;
  error_type: string;
  error_code: string;
  message: string;
  stack_trace?: string;
  request_id?: string;
  user_id?: string;
  endpoint?: string;
  method?: string;
  user_agent?: string;
  ip_address?: string;
  status: 'active' | 'resolved' | 'ignored';
  resolved_at?: string;
  resolved_by?: string;
  resolution_note?: string;
  metadata?: string;
  created_at: string;
}

/**
 * Error filters for querying
 */
export interface ErrorFilters {
  errorType?: string;
  errorCode?: string;
  status?: 'active' | 'resolved' | 'ignored';
  userId?: string;
  requestId?: string;
  startDate?: string;
  endDate?: string;
  limit?: number;
  offset?: number;
}

/**
 * Error statistics
 */
export interface ErrorStats {
  total: number;
  byType: Record<string, number>;
  byCode: Record<string, number>;
  byStatus: Record<string, number>;
  errorRate: number; // errors per minute in the time window
}

/**
 * ErrorTracker class for capturing and managing errors
 */
export class ErrorTracker {
  constructor(private db: D1Database) {}

  /**
   * Capture an error with context
   * Non-blocking operation - stores error asynchronously
   */
  async capture(error: Error | AppError, context: ErrorContext = {}): Promise<void> {
    try {
      const errorId = crypto.randomUUID();
      const now = new Date().toISOString();

      // Determine error type and code
      let errorType = 'Error';
      let errorCode = 'INTERNAL_ERROR';
      let statusCode = 500;

      if (error instanceof Error && 'name' in error) {
        errorType = error.name;
      }

      // Check if it's an AppError with additional properties
      if (error && typeof error === 'object') {
        if ('code' in error) {
          errorCode = String((error as any).code);
        }
        if ('statusCode' in error) {
          statusCode = Number((error as any).statusCode);
        }
      }

      // Prepare stack trace
      let stackTrace: string | undefined;
      if (error instanceof Error && error.stack) {
        stackTrace = error.stack;
      }

      // Prepare metadata JSON
      const metadataJson = context.metadata
        ? JSON.stringify(context.metadata)
        : undefined;

      // Insert error log (non-blocking)
      await this.db
        .prepare(
          `
          INSERT INTO error_logs (
            id, error_type, error_code, message, stack_trace,
            request_id, user_id, endpoint, method, user_agent, ip_address,
            metadata, created_at
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
          `
        )
        .bind(
          errorId,
          errorType,
          errorCode,
          error.message,
          stackTrace,
          context.requestId,
          context.userId,
          context.endpoint,
          context.method,
          context.userAgent,
          context.ip,
          metadataJson,
          now
        )
        .run();

      // Log to console for immediate visibility
      console.error(`[Error:${errorType}]`, {
        id: errorId,
        message: error.message,
        code: errorCode,
        context,
      });
    } catch (dbError) {
      // Don't throw when logging errors - circular dependency prevention
      console.error('Failed to capture error:', dbError);
    }
  }

  /**
   * Query errors with filters
   */
  async getErrors(filters: ErrorFilters = {}): Promise<ErrorLog[]> {
    try {
      const conditions: string[] = [];
      const params: any[] = [];

      // Build WHERE clause
      if (filters.errorType) {
        conditions.push('error_type = ?');
        params.push(filters.errorType);
      }

      if (filters.errorCode) {
        conditions.push('error_code = ?');
        params.push(filters.errorCode);
      }

      if (filters.status) {
        conditions.push('status = ?');
        params.push(filters.status);
      }

      if (filters.userId) {
        conditions.push('user_id = ?');
        params.push(filters.userId);
      }

      if (filters.requestId) {
        conditions.push('request_id = ?');
        params.push(filters.requestId);
      }

      if (filters.startDate) {
        conditions.push('created_at >= ?');
        params.push(filters.startDate);
      }

      if (filters.endDate) {
        conditions.push('created_at <= ?');
        params.push(filters.endDate);
      }

      const whereClause =
        conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

      // Add limit and offset
      const limit = filters.limit || 100;
      const offset = filters.offset || 0;

      const query = `
        SELECT * FROM error_logs
        ${whereClause}
        ORDER BY created_at DESC
        LIMIT ? OFFSET ?
      `;

      const results = await this.db
        .prepare(query)
        .bind(...params, limit, offset)
        .all();

      return ((results.results || []) as unknown) as ErrorLog[];
    } catch (error) {
      console.error('Failed to query errors:', error);
      return [];
    }
  }

  /**
   * Get error by ID
   */
  async getErrorById(errorId: string): Promise<ErrorLog | null> {
    try {
      const result = await this.db
        .prepare('SELECT * FROM error_logs WHERE id = ?')
        .bind(errorId)
        .first();

      return ((result as unknown) as ErrorLog) || null;
    } catch (error) {
      console.error('Failed to get error by ID:', error);
      return null;
    }
  }

  /**
   * Get recent errors (last N errors)
   */
  async getRecentErrors(limit: number = 100): Promise<ErrorLog[]> {
    return this.getErrors({ limit });
  }

  /**
   * Get errors by type
   */
  async getErrorsByType(
    errorType: string,
    limit: number = 50
  ): Promise<ErrorLog[]> {
    return this.getErrors({ errorType, limit });
  }

  /**
   * Get errors by user ID
   */
  async getErrorsByUser(
    userId: string,
    limit: number = 50
  ): Promise<ErrorLog[]> {
    return this.getErrors({ userId, limit });
  }

  /**
   * Mark error as resolved
   */
  async resolveError(
    errorId: string,
    adminId: string,
    note?: string
  ): Promise<boolean> {
    try {
      const now = new Date().toISOString();
      await this.db
        .prepare(
          `
          UPDATE error_logs
          SET status = 'resolved',
              resolved_at = ?,
              resolved_by = ?,
              resolution_note = ?
          WHERE id = ?
          `
        )
        .bind(now, adminId, note || null, errorId)
        .run();

      return true;
    } catch (error) {
      console.error('Failed to resolve error:', error);
      return false;
    }
  }

  /**
   * Mark error as ignored
   */
  async ignoreError(errorId: string): Promise<boolean> {
    try {
      await this.db
        .prepare('UPDATE error_logs SET status = ? WHERE id = ?')
        .bind('ignored', errorId)
        .run();

      return true;
    } catch (error) {
      console.error('Failed to ignore error:', error);
      return false;
    }
  }

  /**
   * Delete old errors (cleanup)
   * @param daysToKeep - number of days to retain errors (default 30)
   */
  async cleanupOldErrors(daysToKeep: number = 30): Promise<number> {
    try {
      const cutoffDate = new Date();
      cutoffDate.setDate(cutoffDate.getDate() - daysToKeep);
      const cutoffIso = cutoffDate.toISOString();

      const result = await this.db
        .prepare('DELETE FROM error_logs WHERE created_at < ? AND status = ?')
        .bind(cutoffIso, 'resolved')
        .run();

      return result.meta.changes || 0;
    } catch (error) {
      console.error('Failed to cleanup old errors:', error);
      return 0;
    }
  }

  /**
   * Export errors to CSV format
   */
  async exportErrors(filters: ErrorFilters = {}): Promise<string> {
    const errors = await this.getErrors(filters);

    const headers = [
      'id',
      'error_type',
      'error_code',
      'message',
      'request_id',
      'user_id',
      'endpoint',
      'method',
      'status',
      'created_at',
    ];

    const csvRows = [headers.join(',')];

    for (const error of errors) {
      const row = headers.map((header) => {
        const value = error[header as keyof ErrorLog];
        // Escape commas and quotes
        if (value === null || value === undefined) return '';
        const stringValue = String(value);
        if (stringValue.includes(',') || stringValue.includes('"')) {
          return `"${stringValue.replace(/"/g, '""')}"`;
        }
        return stringValue;
      });
      csvRows.push(row.join(','));
    }

    return csvRows.join('\n');
  }
}
