import type { DatabaseConnection } from '../connection.js';

export interface GameUserRecord {
  id: number;
  gameKey: string;
  platform: string;
  platformOpenId: string;
  nickname: string;
  avatar: string;
  status: 'active';
  createdAt: number;
  lastLoginAt: number;
}

export class GameUserRepository {
  private readonly database: DatabaseConnection;

  constructor(database: DatabaseConnection) {
    this.database = database;
  }

  findOrCreate(input: {
    gameKey: string;
    platform: string;
    platformOpenId: string;
  }): { record: GameUserRecord; isNewUser: boolean } {
    const existing = this.database.sqlite
      .prepare(
        `
          SELECT id, game_key, platform, platform_open_id, nickname, avatar, status, created_at, last_login_at
          FROM game_user
          WHERE game_key = ? AND platform = ? AND platform_open_id = ?
        `
      )
      .get(input.gameKey, input.platform, input.platformOpenId) as
      | {
          id: number;
          game_key: string;
          platform: string;
          platform_open_id: string;
          nickname: string;
          avatar: string;
          status: 'active';
          created_at: number;
          last_login_at: number;
        }
      | undefined;

    if (existing) {
      const now = Date.now();
      this.database.sqlite
        .prepare(
          `
            UPDATE game_user
            SET last_login_at = ?, updated_at = ?
            WHERE id = ?
          `
        )
        .run(now, now, existing.id);

      return {
        record: {
          id: existing.id,
          gameKey: existing.game_key,
          platform: existing.platform,
          platformOpenId: existing.platform_open_id,
          nickname: existing.nickname,
          avatar: existing.avatar,
          status: existing.status,
          createdAt: existing.created_at,
          lastLoginAt: now
        },
        isNewUser: false
      };
    }

    const now = Date.now();
    const insert = this.database.sqlite.prepare(
      `
        INSERT INTO game_user (
          game_key,
          platform,
          platform_open_id,
          nickname,
          avatar,
          status,
          created_at,
          updated_at,
          last_login_at
        ) VALUES (?, ?, ?, '', '', 'active', ?, ?, ?)
      `
    );
    const result = insert.run(input.gameKey, input.platform, input.platformOpenId, now, now, now);
    const record: GameUserRecord = {
      id: Number(result.lastInsertRowid),
      gameKey: input.gameKey,
      platform: input.platform,
      platformOpenId: input.platformOpenId,
      nickname: '',
      avatar: '',
      status: 'active',
      createdAt: now,
      lastLoginAt: now
    };

    return {
      record,
      isNewUser: true
    };
  }

  findById(id: number): GameUserRecord | null {
    const row = this.database.sqlite
      .prepare(
        `
          SELECT id, game_key, platform, platform_open_id, nickname, avatar, status, created_at, last_login_at
          FROM game_user
          WHERE id = ?
          LIMIT 1
        `
      )
      .get(id) as
      | {
          id: number;
          game_key: string;
          platform: string;
          platform_open_id: string;
          nickname: string;
          avatar: string;
          status: 'active';
          created_at: number;
          last_login_at: number;
        }
      | undefined;

    if (!row) {
      return null;
    }

    return {
      id: row.id,
      gameKey: row.game_key,
      platform: row.platform,
      platformOpenId: row.platform_open_id,
      nickname: row.nickname,
      avatar: row.avatar,
      status: row.status,
      createdAt: row.created_at,
      lastLoginAt: row.last_login_at
    };
  }

  list(filters: {
    gameKey?: string;
    platform?: string;
    platformOpenId?: string;
    status?: GameUserRecord['status'];
  } = {}): GameUserRecord[] {
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

    if (filters.platformOpenId) {
      conditions.push('platform_open_id = ?');
      values.push(filters.platformOpenId);
    }

    if (filters.status) {
      conditions.push('status = ?');
      values.push(filters.status);
    }

    const rows = this.database.sqlite
      .prepare(
        `
          SELECT id, game_key, platform, platform_open_id, nickname, avatar, status, created_at, last_login_at
          FROM game_user
          WHERE ${conditions.join(' AND ')}
          ORDER BY id DESC
        `
      )
      .all(...values) as Array<{
      id: number;
      game_key: string;
      platform: string;
      platform_open_id: string;
      nickname: string;
      avatar: string;
      status: 'active';
      created_at: number;
      last_login_at: number;
    }>;

    return rows.map((row) => ({
      id: row.id,
      gameKey: row.game_key,
      platform: row.platform,
      platformOpenId: row.platform_open_id,
      nickname: row.nickname,
      avatar: row.avatar,
      status: row.status,
      createdAt: row.created_at,
      lastLoginAt: row.last_login_at
    }));
  }

  countCreatedSince(gameKey: string, since: number): number {
    const row = this.database.sqlite
      .prepare(
        `
          SELECT COUNT(*) AS count
          FROM game_user
          WHERE game_key = ? AND created_at >= ?
        `
      )
      .get(gameKey, since) as { count: number };

    return row.count;
  }

  countLoggedInSince(gameKey: string, since: number): number {
    const row = this.database.sqlite
      .prepare(
        `
          SELECT COUNT(*) AS count
          FROM game_user
          WHERE game_key = ? AND last_login_at >= ?
        `
      )
      .get(gameKey, since) as { count: number };

    return row.count;
  }
}
