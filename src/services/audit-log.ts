/**
 * Audit Logging Service
 *
 * Logs all administrative actions for compliance and security
 */

export interface AuditLogEntry {
  id?: string;
  actor_type: 'seller' | 'admin' | 'system';
  actor_id: string | null;
  action: string;
  target_type: string;
  target_id: string;
  old_values?: string; // JSON string
  new_values?: string; // JSON string
  reason?: string;
  ip_address?: string;
  user_agent?: string;
  created_at?: string;
}

export class AuditLogService {
  private db: D1Database;

  constructor(db: D1Database) {
    this.db = db;
  }

  /**
   * Log an admin action
   *
   * @param entry - Audit log entry
   * @returns The created audit log ID
   */
  async log(entry: AuditLogEntry): Promise<string> {
    const id = entry.id || crypto.randomUUID();
    const createdAt = entry.created_at || new Date().toISOString();

    const stmt = this.db.prepare(
      `
      INSERT INTO audit_log (
        id, actor_type, actor_id, action, target_type, target_id,
        old_values, new_values, reason, ip_address, user_agent, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `
    );

    await stmt.bind(
      id,
      entry.actor_type,
      entry.actor_id,
      entry.action,
      entry.target_type,
      entry.target_id,
      entry.old_values || null,
      entry.new_values || null,
      entry.reason || null,
      entry.ip_address || null,
      entry.user_agent || null,
      createdAt
    ).run();

    return id;
  }

  /**
   * Log admin transaction release
   */
  async logTransactionRelease(params: {
    adminId: string;
    transactionId: string;
    oldStatus: string;
    newStatus: string;
    reason: string;
    ipAddress?: string;
    userAgent?: string;
  }): Promise<string> {
    return this.log({
      actor_type: 'admin',
      actor_id: params.adminId,
      action: 'transaction.release',
      target_type: 'transaction',
      target_id: params.transactionId,
      old_values: JSON.stringify({ status: params.oldStatus }),
      new_values: JSON.stringify({ status: params.newStatus }),
      reason: params.reason,
      ip_address: params.ipAddress,
      user_agent: params.userAgent,
    });
  }

  /**
   * Log admin transaction refund
   */
  async logTransactionRefund(params: {
    adminId: string;
    transactionId: string;
    oldStatus: string;
    newStatus: string;
    reason: string;
    ipAddress?: string;
    userAgent?: string;
  }): Promise<string> {
    return this.log({
      actor_type: 'admin',
      actor_id: params.adminId,
      action: 'transaction.refund',
      target_type: 'transaction',
      target_id: params.transactionId,
      old_values: JSON.stringify({ status: params.oldStatus }),
      new_values: JSON.stringify({ status: params.newStatus }),
      reason: params.reason,
      ip_address: params.ipAddress,
      user_agent: params.userAgent,
    });
  }

  /**
   * Log admin dispute resolution
   */
  async logDisputeResolution(params: {
    adminId: string;
    disputeId: string;
    oldStatus: string;
    newStatus: string;
    resolution: string;
    reason?: string;
    ipAddress?: string;
    userAgent?: string;
  }): Promise<string> {
    return this.log({
      actor_type: 'admin',
      actor_id: params.adminId,
      action: 'dispute.resolve',
      target_type: 'dispute',
      target_id: params.disputeId,
      old_values: JSON.stringify({ status: params.oldStatus }),
      new_values: JSON.stringify({
        status: params.newStatus,
        resolution: params.resolution,
      }),
      reason: params.reason,
      ip_address: params.ipAddress,
      user_agent: params.userAgent,
    });
  }

  /**
   * Log admin account access
   */
  async logAdminAccess(params: {
    adminId: string;
    action: string;
    ipAddress?: string;
    userAgent?: string;
  }): Promise<string> {
    return this.log({
      actor_type: 'admin',
      actor_id: params.adminId,
      action: params.action,
      target_type: 'admin',
      target_id: params.adminId,
      reason: 'Admin panel access',
      ip_address: params.ipAddress,
      user_agent: params.userAgent,
    });
  }

  /**
   * Get audit logs for a specific target
   */
  async getTargetLogs(params: {
    targetType: string;
    targetId: string;
    limit?: number;
    offset?: number;
  }): Promise<AuditLogEntry[]> {
    const limit = params.limit || 100;
    const offset = params.offset || 0;

    const stmt = this.db.prepare(
      `
      SELECT
        id, actor_type, actor_id, action, target_type, target_id,
        old_values, new_values, reason, ip_address, user_agent, created_at
      FROM audit_log
      WHERE target_type = ?
      AND target_id = ?
      ORDER BY created_at DESC
      LIMIT ? OFFSET ?
      `
    );

    const result = await stmt
      .bind(params.targetType, params.targetId, limit, offset)
      .all();

    return (result.results as unknown) as AuditLogEntry[];
  }

  /**
   * Get audit logs by actor
   */
  async getActorLogs(params: {
    actorType: string;
    actorId: string;
    limit?: number;
    offset?: number;
  }): Promise<AuditLogEntry[]> {
    const limit = params.limit || 100;
    const offset = params.offset || 0;

    const stmt = this.db.prepare(
      `
      SELECT
        id, actor_type, actor_id, action, target_type, target_id,
        old_values, new_values, reason, ip_address, user_agent, created_at
      FROM audit_log
      WHERE actor_type = ?
      AND actor_id = ?
      ORDER BY created_at DESC
      LIMIT ? OFFSET ?
      `
    );

    const result = await stmt
      .bind(params.actorType, params.actorId, limit, offset)
      .all();

    return (result.results as unknown) as AuditLogEntry[];
  }
}
