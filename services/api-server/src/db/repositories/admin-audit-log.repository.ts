import type { DatabaseConnection } from '../connection.js';

export interface AdminAuditLogRecord {
  id: number;
  adminUserId: number;
  adminUsername: string;
  roleCode: string;
  action: string;
  targetType: string;
  targetKey: string;
  gameKey: string | null;
  detail: Record<string, unknown>;
  createdAt: number;
}

interface AdminAuditLogRow {
  id: number;
  admin_user_id: number;
  admin_username: string;
  role_code: string;
  action: string;
  target_type: string;
  target_key: string;
  game_key: string | null;
  detail_json: string;
  created_at: number;
}

export class AdminAuditLogRepository {
  private readonly database: DatabaseConnection;

  constructor(database: DatabaseConnection) {
    this.database = database;
  }

  create(input: Omit<AdminAuditLogRecord, 'id' | 'createdAt'> & { createdAt?: number }): AdminAuditLogRecord {
    const createdAt = input.createdAt ?? Date.now();
    const result = this.database.sqlite
      .prepare(
        `
          INSERT INTO admin_audit_log (
            admin_user_id,
            admin_username,
            role_code,
            action,
            target_type,
            target_key,
            game_key,
            detail_json,
            created_at
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
        `
      )
      .run(
        input.adminUserId,
        input.adminUsername,
        input.roleCode,
        input.action,
        input.targetType,
        input.targetKey,
        input.gameKey,
        JSON.stringify(input.detail),
        createdAt
      );

    return {
      ...input,
      id: Number(result.lastInsertRowid),
      createdAt
    };
  }

  list(filters: {
    gameKey?: string;
    adminUserId?: number;
    action?: string;
    targetType?: string;
  } = {}): AdminAuditLogRecord[] {
    const conditions = ['1 = 1'];
    const values: Array<string | number> = [];

    if (filters.gameKey) {
      conditions.push('game_key = ?');
      values.push(filters.gameKey);
    }

    if (filters.adminUserId !== undefined) {
      conditions.push('admin_user_id = ?');
      values.push(filters.adminUserId);
    }

    if (filters.action) {
      conditions.push('action = ?');
      values.push(filters.action);
    }

    if (filters.targetType) {
      conditions.push('target_type = ?');
      values.push(filters.targetType);
    }

    const rows = this.database.sqlite
      .prepare(
        `
          SELECT
            id,
            admin_user_id,
            admin_username,
            role_code,
            action,
            target_type,
            target_key,
            game_key,
            detail_json,
            created_at
          FROM admin_audit_log
          WHERE ${conditions.join(' AND ')}
          ORDER BY id DESC
        `
      )
      .all(...values) as AdminAuditLogRow[];

    return rows.map((row) => ({
      id: row.id,
      adminUserId: row.admin_user_id,
      adminUsername: row.admin_username,
      roleCode: row.role_code,
      action: row.action,
      targetType: row.target_type,
      targetKey: row.target_key,
      gameKey: row.game_key,
      detail: JSON.parse(row.detail_json) as Record<string, unknown>,
      createdAt: row.created_at
    }));
  }
}
