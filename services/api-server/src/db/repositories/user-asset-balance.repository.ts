import type { DatabaseConnection } from '../connection.js';

export interface UserAssetBalanceRecord {
  gameKey: string;
  gameUserId: number;
  assetType: string;
  balance: number;
  updatedAt: number;
}

export class UserAssetBalanceRepository {
  private readonly database: DatabaseConnection;

  constructor(database: DatabaseConnection) {
    this.database = database;
  }

  increment(gameKey: string, gameUserId: number, assetType: string, amount: number): UserAssetBalanceRecord {
    const updatedAt = Date.now();
    this.database.sqlite
      .prepare(
        `
          INSERT INTO user_asset_balance (
            game_key,
            game_user_id,
            asset_type,
            balance,
            updated_at
          ) VALUES (?, ?, ?, ?, ?)
          ON CONFLICT(game_key, game_user_id, asset_type)
          DO UPDATE SET
            balance = user_asset_balance.balance + excluded.balance,
            updated_at = excluded.updated_at
        `
      )
      .run(gameKey, gameUserId, assetType, amount, updatedAt);

    const record = this.get(gameKey, gameUserId, assetType);
    if (!record) {
      throw new Error('Failed to load updated asset balance.');
    }

    return record;
  }

  get(gameKey: string, gameUserId: number, assetType: string): UserAssetBalanceRecord | null {
    const row = this.database.sqlite
      .prepare(
        `
          SELECT game_key, game_user_id, asset_type, balance, updated_at
          FROM user_asset_balance
          WHERE game_key = ? AND game_user_id = ? AND asset_type = ?
        `
      )
      .get(gameKey, gameUserId, assetType) as
      | {
          game_key: string;
          game_user_id: number;
          asset_type: string;
          balance: number;
          updated_at: number;
        }
      | undefined;

    if (!row) {
      return null;
    }

    return {
      gameKey: row.game_key,
      gameUserId: row.game_user_id,
      assetType: row.asset_type,
      balance: row.balance,
      updatedAt: row.updated_at
    };
  }
}
