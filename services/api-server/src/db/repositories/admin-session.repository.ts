import type { AdminGrantedPermission } from '@mini-game-workflow/game-core-types';
import { hashAdminSessionToken } from '../../common/admin.js';
import type { DatabaseConnection } from '../connection.js';

export interface AdminSessionRecord {
  id: number;
  adminUserId: number;
  username: string;
  displayName: string;
  roleCode: string;
  roleName: string;
  permissions: AdminGrantedPermission[];
  status: 'active' | 'disabled';
  expiresAt: number;
  createdAt: number;
  lastSeenAt: number;
}

interface AdminSessionRow {
  id: number;
  admin_user_id: number;
  username: string;
  display_name: string;
  role_code: string;
  role_name: string;
  permissions_json: string;
  status: 'active' | 'disabled';
  expires_at: number;
  created_at: number;
  last_seen_at: number;
}

export class AdminSessionRepository {
  private readonly database: DatabaseConnection;

  constructor(database: DatabaseConnection) {
    this.database = database;
  }

  create(input: {
    adminUserId: number;
    token: string;
    expiresAt: number;
    createdAt?: number;
  }): void {
    const now = input.createdAt ?? Date.now();
    this.database.sqlite
      .prepare(
        `
          INSERT INTO admin_session (
            admin_user_id,
            session_token_hash,
            expires_at,
            created_at,
            last_seen_at,
            revoked_at
          ) VALUES (?, ?, ?, ?, ?, NULL)
        `
      )
      .run(input.adminUserId, hashAdminSessionToken(input.token), input.expiresAt, now, now);
  }

  findByToken(token: string, now = Date.now()): AdminSessionRecord | null {
    const row = this.database.sqlite
      .prepare(
        `
          SELECT
            admin_session.id,
            admin_session.admin_user_id,
            admin_user.username,
            admin_user.display_name,
            admin_user.role_code,
            admin_role.name AS role_name,
            admin_role.permissions_json,
            admin_user.status,
            admin_session.expires_at,
            admin_session.created_at,
            admin_session.last_seen_at
          FROM admin_session
          INNER JOIN admin_user ON admin_user.id = admin_session.admin_user_id
          INNER JOIN admin_role ON admin_role.code = admin_user.role_code
          WHERE admin_session.session_token_hash = ?
            AND admin_session.revoked_at IS NULL
            AND admin_session.expires_at > ?
            AND admin_user.status = 'active'
            AND admin_role.status = 'active'
          LIMIT 1
        `
      )
      .get(hashAdminSessionToken(token), now) as AdminSessionRow | undefined;

    return row ? this.mapRow(row) : null;
  }

  touch(id: number, now = Date.now()): void {
    this.database.sqlite
      .prepare(
        `
          UPDATE admin_session
          SET last_seen_at = ?
          WHERE id = ?
        `
      )
      .run(now, id);
  }

  revokeByToken(token: string, revokedAt = Date.now()): boolean {
    const result = this.database.sqlite
      .prepare(
        `
          UPDATE admin_session
          SET revoked_at = ?, last_seen_at = ?
          WHERE session_token_hash = ? AND revoked_at IS NULL
        `
      )
      .run(revokedAt, revokedAt, hashAdminSessionToken(token));

    return result.changes > 0;
  }

  private mapRow(row: AdminSessionRow): AdminSessionRecord {
    return {
      id: row.id,
      adminUserId: row.admin_user_id,
      username: row.username,
      displayName: row.display_name,
      roleCode: row.role_code,
      roleName: row.role_name,
      permissions: JSON.parse(row.permissions_json) as AdminGrantedPermission[],
      status: row.status,
      expiresAt: row.expires_at,
      createdAt: row.created_at,
      lastSeenAt: row.last_seen_at
    };
  }
}
