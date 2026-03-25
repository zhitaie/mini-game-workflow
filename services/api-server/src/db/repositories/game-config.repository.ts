import type { DatabaseConnection } from '../connection.js';

export interface GameConfigRecord {
  gameKey: string;
  platform: string;
  configVersion: string;
  minClientVersion?: string;
  maxClientVersion?: string;
  payload: Record<string, unknown>;
  status: 'draft' | 'active' | 'archived';
  updatedAt: number;
}

export class GameConfigRepository {
  private readonly database: DatabaseConnection;

  constructor(database: DatabaseConnection) {
    this.database = database;
  }

  setActive(record: Omit<GameConfigRecord, 'status' | 'updatedAt'> & { updatedAt?: number }): void {
    const now = record.updatedAt ?? Date.now();
    this.database.sqlite
      .prepare(
        `
          UPDATE game_config
          SET status = 'archived', archived_at = ?, updated_at = ?
          WHERE game_key = ? AND platform = ? AND status = 'active'
        `
      )
      .run(now, now, record.gameKey, record.platform);

    this.database.sqlite
      .prepare(
        `
          INSERT INTO game_config (
            game_key,
            platform,
            config_version,
            min_client_version,
            max_client_version,
            config_json,
            status,
            created_at,
            published_at,
            archived_at,
            updated_at
          ) VALUES (?, ?, ?, ?, ?, ?, 'active', ?, ?, NULL, ?)
          ON CONFLICT(game_key, platform, config_version)
          DO UPDATE SET
            min_client_version = excluded.min_client_version,
            max_client_version = excluded.max_client_version,
            config_json = excluded.config_json,
            status = 'active',
            published_at = excluded.published_at,
            archived_at = NULL,
            updated_at = excluded.updated_at
        `
      )
      .run(
        record.gameKey,
        record.platform,
        record.configVersion,
        record.minClientVersion ?? null,
        record.maxClientVersion ?? null,
        JSON.stringify(record.payload),
        now,
        now,
        now
      );
  }

  findActive(gameKey: string, platform: string): GameConfigRecord | null {
    const row = this.database.sqlite
      .prepare(
        `
          SELECT
            game_key,
            platform,
            config_version,
            min_client_version,
            max_client_version,
            config_json,
            status,
            updated_at
          FROM game_config
          WHERE game_key = ? AND platform = ? AND status = 'active'
          ORDER BY updated_at DESC
          LIMIT 1
        `
      )
      .get(gameKey, platform) as
      | {
          game_key: string;
          platform: string;
          config_version: string;
          min_client_version: string | null;
          max_client_version: string | null;
          config_json: string;
          status: 'draft' | 'active' | 'archived';
          updated_at: number;
        }
      | undefined;

    if (!row) {
      return null;
    }

    return {
      gameKey: row.game_key,
      platform: row.platform,
      configVersion: row.config_version,
      minClientVersion: row.min_client_version ?? undefined,
      maxClientVersion: row.max_client_version ?? undefined,
      payload: JSON.parse(row.config_json) as Record<string, unknown>,
      status: row.status,
      updatedAt: row.updated_at
    };
  }

  list(filters: {
    gameKey?: string;
    platform?: string;
    status?: GameConfigRecord['status'];
  } = {}): GameConfigRecord[] {
    const conditions = ['1 = 1'];
    const values: Array<string> = [];

    if (filters.gameKey) {
      conditions.push('game_key = ?');
      values.push(filters.gameKey);
    }

    if (filters.platform) {
      conditions.push('platform = ?');
      values.push(filters.platform);
    }

    if (filters.status) {
      conditions.push('status = ?');
      values.push(filters.status);
    }

    const rows = this.database.sqlite
      .prepare(
        `
          SELECT
            game_key,
            platform,
            config_version,
            min_client_version,
            max_client_version,
            config_json,
            status,
            updated_at
          FROM game_config
          WHERE ${conditions.join(' AND ')}
          ORDER BY updated_at DESC
        `
      )
      .all(...values) as Array<{
      game_key: string;
      platform: string;
      config_version: string;
      min_client_version: string | null;
      max_client_version: string | null;
      config_json: string;
      status: 'draft' | 'active' | 'archived';
      updated_at: number;
    }>;

    return rows.map((row) => ({
      gameKey: row.game_key,
      platform: row.platform,
      configVersion: row.config_version,
      minClientVersion: row.min_client_version ?? undefined,
      maxClientVersion: row.max_client_version ?? undefined,
      payload: JSON.parse(row.config_json) as Record<string, unknown>,
      status: row.status,
      updatedAt: row.updated_at
    }));
  }
}
