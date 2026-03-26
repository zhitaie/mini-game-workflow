import type { AdminGrantedPermission } from '@mini-game-workflow/game-core-types';
import type { DatabaseConnection } from '../connection.js';

export interface AdminUserRecord {
  id: number;
  username: string;
  displayName: string;
  passwordHash: string;
  roleCode: string;
  roleName: string;
  permissions: AdminGrantedPermission[];
  status: 'active' | 'disabled';
  createdAt: number;
  updatedAt: number;
}

interface AdminUserRow {
  id: number;
  username: string;
  display_name: string;
  password_hash: string;
  role_code: string;
  role_name: string;
  permissions_json: string;
  status: 'active' | 'disabled';
  created_at: number;
  updated_at: number;
}

export class AdminUserRepository {
  private readonly database: DatabaseConnection;

  constructor(database: DatabaseConnection) {
    this.database = database;
  }

  upsert(input: Omit<AdminUserRecord, 'id' | 'roleName' | 'permissions' | 'createdAt' | 'updatedAt'> & { createdAt?: number; updatedAt?: number }): AdminUserRecord {
    const now = input.updatedAt ?? Date.now();
    const createdAt = input.createdAt ?? now;
    this.database.sqlite
      .prepare(
        `
          INSERT INTO admin_user (
            username,
            display_name,
            password_hash,
            role_code,
            status,
            created_at,
            updated_at
          ) VALUES (?, ?, ?, ?, ?, ?, ?)
          ON CONFLICT(username)
          DO UPDATE SET
            display_name = excluded.display_name,
            password_hash = excluded.password_hash,
            role_code = excluded.role_code,
            status = excluded.status,
            updated_at = excluded.updated_at
        `
      )
      .run(input.username, input.displayName, input.passwordHash, input.roleCode, input.status, createdAt, now);

    return this.findByUsername(input.username) as AdminUserRecord;
  }

  findByUsername(username: string): AdminUserRecord | null {
    const row = this.database.sqlite
      .prepare(
        `
          SELECT
            admin_user.id,
            admin_user.username,
            admin_user.display_name,
            admin_user.password_hash,
            admin_user.role_code,
            admin_role.name AS role_name,
            admin_role.permissions_json,
            admin_user.status,
            admin_user.created_at,
            admin_user.updated_at
          FROM admin_user
          INNER JOIN admin_role ON admin_role.code = admin_user.role_code
          WHERE admin_user.username = ?
          LIMIT 1
        `
      )
      .get(username) as AdminUserRow | undefined;

    return row ? this.mapRow(row) : null;
  }

  findById(id: number): AdminUserRecord | null {
    const row = this.database.sqlite
      .prepare(
        `
          SELECT
            admin_user.id,
            admin_user.username,
            admin_user.display_name,
            admin_user.password_hash,
            admin_user.role_code,
            admin_role.name AS role_name,
            admin_role.permissions_json,
            admin_user.status,
            admin_user.created_at,
            admin_user.updated_at
          FROM admin_user
          INNER JOIN admin_role ON admin_role.code = admin_user.role_code
          WHERE admin_user.id = ?
          LIMIT 1
        `
      )
      .get(id) as AdminUserRow | undefined;

    return row ? this.mapRow(row) : null;
  }

  private mapRow(row: AdminUserRow): AdminUserRecord {
    return {
      id: row.id,
      username: row.username,
      displayName: row.display_name,
      passwordHash: row.password_hash,
      roleCode: row.role_code,
      roleName: row.role_name,
      permissions: JSON.parse(row.permissions_json) as AdminGrantedPermission[],
      status: row.status,
      createdAt: row.created_at,
      updatedAt: row.updated_at
    };
  }
}
