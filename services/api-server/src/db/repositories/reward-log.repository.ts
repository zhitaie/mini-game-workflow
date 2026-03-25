import type { DatabaseConnection } from '../connection.js';

export interface RewardLogRecord {
  gameKey: string;
  gameUserId: number;
  rewardType: string;
  amount: number;
  reason: string;
  bizId: string;
  status: 'success';
  balanceAfter: number;
  createdAt: number;
}

export class RewardLogRepository {
  private readonly database: DatabaseConnection;

  constructor(database: DatabaseConnection) {
    this.database = database;
  }

  get(gameKey: string, gameUserId: number, bizId: string): RewardLogRecord | null {
    const row = this.database.sqlite
      .prepare(
        `
          SELECT
            game_key,
            game_user_id,
            reward_type,
            amount,
            reason,
            biz_id,
            status,
            balance_after,
            created_at
          FROM reward_log
          WHERE game_key = ? AND game_user_id = ? AND biz_id = ?
        `
      )
      .get(gameKey, gameUserId, bizId) as
      | {
          game_key: string;
          game_user_id: number;
          reward_type: string;
          amount: number;
          reason: string;
          biz_id: string;
          status: 'success';
          balance_after: number;
          created_at: number;
        }
      | undefined;

    if (!row) {
      return null;
    }

    return {
      gameKey: row.game_key,
      gameUserId: row.game_user_id,
      rewardType: row.reward_type,
      amount: row.amount,
      reason: row.reason,
      bizId: row.biz_id,
      status: row.status,
      balanceAfter: row.balance_after,
      createdAt: row.created_at
    };
  }

  save(record: Omit<RewardLogRecord, 'createdAt'>): RewardLogRecord {
    const createdAt = Date.now();
    this.database.sqlite
      .prepare(
        `
          INSERT INTO reward_log (
            game_key,
            game_user_id,
            reward_type,
            amount,
            reason,
            biz_id,
            status,
            balance_after,
            created_at
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
        `
      )
      .run(
        record.gameKey,
        record.gameUserId,
        record.rewardType,
        record.amount,
        record.reason,
        record.bizId,
        record.status,
        record.balanceAfter,
        createdAt
      );

    const fullRecord: RewardLogRecord = {
      ...record,
      createdAt
    };
    return fullRecord;
  }

  list(filters: {
    gameKey?: string;
    gameUserId?: number;
    rewardType?: string;
    reason?: string;
    bizId?: string;
  } = {}): RewardLogRecord[] {
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

    if (filters.rewardType) {
      conditions.push('reward_type = ?');
      values.push(filters.rewardType);
    }

    if (filters.reason) {
      conditions.push('reason = ?');
      values.push(filters.reason);
    }

    if (filters.bizId) {
      conditions.push('biz_id = ?');
      values.push(filters.bizId);
    }

    const rows = this.database.sqlite
      .prepare(
        `
          SELECT
            game_key,
            game_user_id,
            reward_type,
            amount,
            reason,
            biz_id,
            status,
            balance_after,
            created_at
          FROM reward_log
          WHERE ${conditions.join(' AND ')}
          ORDER BY created_at DESC
        `
      )
      .all(...values) as Array<{
      game_key: string;
      game_user_id: number;
      reward_type: string;
      amount: number;
      reason: string;
      biz_id: string;
      status: 'success';
      balance_after: number;
      created_at: number;
    }>;

    return rows.map((row) => ({
      gameKey: row.game_key,
      gameUserId: row.game_user_id,
      rewardType: row.reward_type,
      amount: row.amount,
      reason: row.reason,
      bizId: row.biz_id,
      status: row.status,
      balanceAfter: row.balance_after,
      createdAt: row.created_at
    }));
  }

  countSince(gameKey: string, since: number): number {
    const row = this.database.sqlite
      .prepare(
        `
          SELECT COUNT(*) AS count
          FROM reward_log
          WHERE game_key = ? AND created_at >= ?
        `
      )
      .get(gameKey, since) as { count: number };

    return row.count;
  }
}
