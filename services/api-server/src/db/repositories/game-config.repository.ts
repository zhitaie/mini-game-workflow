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

function compareVersion(left: string, right: string): number {
  const leftParts = left.split('.').map((part) => Number(part));
  const rightParts = right.split('.').map((part) => Number(part));
  const maxLength = Math.max(leftParts.length, rightParts.length);

  for (let index = 0; index < maxLength; index += 1) {
    const leftValue = Number.isFinite(leftParts[index]) ? leftParts[index] : 0;
    const rightValue = Number.isFinite(rightParts[index]) ? rightParts[index] : 0;

    if (leftValue > rightValue) {
      return 1;
    }

    if (leftValue < rightValue) {
      return -1;
    }
  }

  return 0;
}

function isWithinRange(clientVersion: string, record: Pick<GameConfigRecord, 'minClientVersion' | 'maxClientVersion'>): boolean {
  if (record.minClientVersion && compareVersion(clientVersion, record.minClientVersion) < 0) {
    return false;
  }

  if (record.maxClientVersion && compareVersion(clientVersion, record.maxClientVersion) > 0) {
    return false;
  }

  return true;
}

function hasOverlappingRange(
  left: Pick<GameConfigRecord, 'minClientVersion' | 'maxClientVersion'>,
  right: Pick<GameConfigRecord, 'minClientVersion' | 'maxClientVersion'>
): boolean {
  if (left.maxClientVersion && right.minClientVersion && compareVersion(left.maxClientVersion, right.minClientVersion) < 0) {
    return false;
  }

  if (right.maxClientVersion && left.minClientVersion && compareVersion(right.maxClientVersion, left.minClientVersion) < 0) {
    return false;
  }

  return true;
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

  saveDraft(record: Omit<GameConfigRecord, 'status' | 'updatedAt'> & { updatedAt?: number }): GameConfigRecord | null {
    const now = record.updatedAt ?? Date.now();
    const existing = this.findByVersion(record.gameKey, record.platform, record.configVersion);

    if (existing?.status === 'active') {
      return null;
    }

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
          ) VALUES (?, ?, ?, ?, ?, ?, 'draft', ?, NULL, NULL, ?)
          ON CONFLICT(game_key, platform, config_version)
          DO UPDATE SET
            min_client_version = excluded.min_client_version,
            max_client_version = excluded.max_client_version,
            config_json = excluded.config_json,
            status = 'draft',
            published_at = NULL,
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
        now
      );

    return {
      ...record,
      status: 'draft',
      updatedAt: now
    };
  }

  ensureActive(record: Omit<GameConfigRecord, 'status' | 'updatedAt'> & { updatedAt?: number }): void {
    const active = this.listActive(record.gameKey, record.platform);
    if (active.length > 0) {
      return;
    }

    this.setActive(record);
  }

  listActive(gameKey: string, platform: string): GameConfigRecord[] {
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
          WHERE game_key = ? AND platform = ? AND status = 'active'
          ORDER BY updated_at DESC
        `
      )
      .all(gameKey, platform) as GameConfigRow[];

    return rows.map((row) => this.mapRow(row));
  }

  findCompatibleActive(gameKey: string, platform: string, clientVersion: string): GameConfigRecord | null {
    const compatible = this.listActive(gameKey, platform)
      .filter((record) => isWithinRange(clientVersion, record))
      .sort((left, right) => {
        const minCompare = compareVersion(left.minClientVersion ?? '0.0.0', right.minClientVersion ?? '0.0.0');
        if (minCompare !== 0) {
          return minCompare > 0 ? -1 : 1;
        }

        return right.updatedAt - left.updatedAt;
      });

    return compatible[0] ?? null;
  }

  findByVersion(gameKey: string, platform: string, configVersion: string): GameConfigRecord | null {
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
          WHERE game_key = ? AND platform = ? AND config_version = ?
          LIMIT 1
        `
      )
      .get(gameKey, platform, configVersion) as GameConfigRow | undefined;

    return row ? this.mapRow(row) : null;
  }

  publishVersion(gameKey: string, platform: string, configVersion: string, updatedAt = Date.now()): GameConfigRecord | null {
    const target = this.findByVersion(gameKey, platform, configVersion);

    if (!target) {
      return null;
    }

    const activeConfigs = this.listActive(gameKey, platform).filter((record) => record.configVersion !== configVersion);
    const overlapping = activeConfigs.find((record) => hasOverlappingRange(record, target));

    if (overlapping) {
      throw new Error(`Config version window overlaps active config ${overlapping.configVersion}`);
    }

    this.database.transaction(() => {
      this.database.sqlite
        .prepare(
          `
            UPDATE game_config
            SET status = 'active', published_at = ?, archived_at = NULL, updated_at = ?
            WHERE game_key = ? AND platform = ? AND config_version = ?
          `
        )
        .run(updatedAt, updatedAt, gameKey, platform, configVersion);
    });

    return this.findByVersion(gameKey, platform, configVersion);
  }

  archiveVersion(gameKey: string, platform: string, configVersion: string, updatedAt = Date.now()): GameConfigRecord | null {
    const result = this.database.sqlite
      .prepare(
        `
          UPDATE game_config
          SET status = 'archived', archived_at = ?, updated_at = ?
          WHERE game_key = ? AND platform = ? AND config_version = ? AND status != 'archived'
        `
      )
      .run(updatedAt, updatedAt, gameKey, platform, configVersion);

    if (result.changes === 0) {
      return null;
    }

    return this.findByVersion(gameKey, platform, configVersion);
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
      .all(...values) as GameConfigRow[];

    return rows.map((row) => this.mapRow(row));
  }

  private mapRow(row: GameConfigRow): GameConfigRecord {
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
}

interface GameConfigRow {
  game_key: string;
  platform: string;
  config_version: string;
  min_client_version: string | null;
  max_client_version: string | null;
  config_json: string;
  status: 'draft' | 'active' | 'archived';
  updated_at: number;
}
