import type { DatabaseConnection } from '../connection.js';

export interface AdLogRecord {
  gameKey: string;
  gameUserId: number;
  sceneKey: string;
  adType: string;
  clientTraceId: string | null;
  verificationId: string;
  verified: boolean;
  completed: boolean;
  errorCode: string | null;
  createdAt: number;
}

export class AdLogRepository {
  private readonly database: DatabaseConnection;

  constructor(database: DatabaseConnection) {
    this.database = database;
  }

  create(input: Omit<AdLogRecord, 'verificationId' | 'createdAt'>): AdLogRecord {
    const verificationId = `verify-${Date.now()}-${Math.floor(Math.random() * 1000000)}`;
    const createdAt = Date.now();
    this.database.sqlite
      .prepare(
        `
          INSERT INTO ad_log (
            game_key,
            game_user_id,
            scene_key,
            ad_type,
            client_trace_id,
            verification_id,
            verified,
            completed,
            error_code,
            created_at
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `
      )
      .run(
        input.gameKey,
        input.gameUserId,
        input.sceneKey,
        input.adType,
        input.clientTraceId,
        verificationId,
        input.verified ? 1 : 0,
        input.completed ? 1 : 0,
        input.errorCode,
        createdAt
      );

    const record: AdLogRecord = {
      ...input,
      verificationId,
      createdAt
    };

    return record;
  }

  findByVerificationId(gameKey: string, verificationId: string): AdLogRecord | null {
    const row = this.database.sqlite
      .prepare(
        `
          SELECT
            game_key,
            game_user_id,
            scene_key,
            ad_type,
            client_trace_id,
            verification_id,
            verified,
            completed,
            error_code,
            created_at
          FROM ad_log
          WHERE game_key = ? AND verification_id = ?
        `
      )
      .get(gameKey, verificationId) as
      | {
          game_key: string;
          game_user_id: number;
          scene_key: string;
          ad_type: string;
          client_trace_id: string | null;
          verification_id: string;
          verified: number;
          completed: number;
          error_code: string | null;
          created_at: number;
        }
      | undefined;

    if (!row) {
      return null;
    }

    return {
      gameKey: row.game_key,
      gameUserId: row.game_user_id,
      sceneKey: row.scene_key,
      adType: row.ad_type,
      clientTraceId: row.client_trace_id,
      verificationId: row.verification_id,
      verified: row.verified === 1,
      completed: row.completed === 1,
      errorCode: row.error_code,
      createdAt: row.created_at
    };
  }

  list(filters: {
    gameKey?: string;
    gameUserId?: number;
    sceneKey?: string;
    verified?: boolean;
    completed?: boolean;
  } = {}): AdLogRecord[] {
    const conditions = ['1 = 1'];
    const values: Array<string | number> = [];

    if (filters.gameKey) {
      conditions.push('game_key = ?');
      values.push(filters.gameKey);
    }

    if (filters.gameUserId !== undefined) {
      conditions.push('game_user_id = ?');
      values.push(filters.gameUserId);
    }

    if (filters.sceneKey) {
      conditions.push('scene_key = ?');
      values.push(filters.sceneKey);
    }

    if (filters.verified !== undefined) {
      conditions.push('verified = ?');
      values.push(filters.verified ? 1 : 0);
    }

    if (filters.completed !== undefined) {
      conditions.push('completed = ?');
      values.push(filters.completed ? 1 : 0);
    }

    const rows = this.database.sqlite
      .prepare(
        `
          SELECT
            game_key,
            game_user_id,
            scene_key,
            ad_type,
            client_trace_id,
            verification_id,
            verified,
            completed,
            error_code,
            created_at
          FROM ad_log
          WHERE ${conditions.join(' AND ')}
          ORDER BY created_at DESC
        `
      )
      .all(...values) as Array<{
      game_key: string;
      game_user_id: number;
      scene_key: string;
      ad_type: string;
      client_trace_id: string | null;
      verification_id: string;
      verified: number;
      completed: number;
      error_code: string | null;
      created_at: number;
    }>;

    return rows.map((row) => ({
      gameKey: row.game_key,
      gameUserId: row.game_user_id,
      sceneKey: row.scene_key,
      adType: row.ad_type,
      clientTraceId: row.client_trace_id,
      verificationId: row.verification_id,
      verified: row.verified === 1,
      completed: row.completed === 1,
      errorCode: row.error_code,
      createdAt: row.created_at
    }));
  }

  countSince(gameKey: string, since: number): number {
    const row = this.database.sqlite
      .prepare(
        `
          SELECT COUNT(*) AS count
          FROM ad_log
          WHERE game_key = ? AND created_at >= ?
        `
      )
      .get(gameKey, since) as { count: number };

    return row.count;
  }
}
