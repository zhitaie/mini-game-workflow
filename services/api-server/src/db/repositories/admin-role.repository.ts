import type { AdminGrantedPermission } from '@mini-game-workflow/game-core-types';
import type { DatabaseConnection } from '../connection.js';

export interface AdminRoleRecord {
  code: string;
  name: string;
  permissions: AdminGrantedPermission[];
  status: 'active' | 'disabled';
  createdAt: number;
  updatedAt: number;
}

interface AdminRoleRow {
  code: string;
  name: string;
  permissions_json: string;
  status: 'active' | 'disabled';
  created_at: number;
  updated_at: number;
}

export class AdminRoleRepository {
  private readonly database: DatabaseConnection;

  constructor(database: DatabaseConnection) {
    this.database = database;
  }

  upsert(input: Omit<AdminRoleRecord, 'createdAt' | 'updatedAt'> & { createdAt?: number; updatedAt?: number }): AdminRoleRecord {
    const now = input.updatedAt ?? Date.now();
    const createdAt = input.createdAt ?? now;
    this.database.sqlite
      .prepare(
        `
          INSERT INTO admin_role (
            code,
            name,
            permissions_json,
            status,
            created_at,
            updated_at
          ) VALUES (?, ?, ?, ?, ?, ?)
          ON CONFLICT(code)
          DO UPDATE SET
            name = excluded.name,
            permissions_json = excluded.permissions_json,
            status = excluded.status,
            updated_at = excluded.updated_at
        `
      )
      .run(input.code, input.name, JSON.stringify(input.permissions), input.status, createdAt, now);

    return this.findByCode(input.code) as AdminRoleRecord;
  }

  findByCode(code: string): AdminRoleRecord | null {
    const row = this.database.sqlite
      .prepare(
        `
          SELECT code, name, permissions_json, status, created_at, updated_at
          FROM admin_role
          WHERE code = ?
          LIMIT 1
        `
      )
      .get(code) as AdminRoleRow | undefined;

    return row ? this.mapRow(row) : null;
  }

  private mapRow(row: AdminRoleRow): AdminRoleRecord {
    return {
      code: row.code,
      name: row.name,
      permissions: JSON.parse(row.permissions_json) as AdminGrantedPermission[],
      status: row.status,
      createdAt: row.created_at,
      updatedAt: row.updated_at
    };
  }
}
