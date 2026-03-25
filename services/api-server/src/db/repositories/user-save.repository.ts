import type { DatabaseConnection } from '../connection.js';

export interface StoredSaveRecord {
  gameKey: string;
  gameUserId: number;
  schemaVersion: number;
  data: Record<string, unknown>;
  updatedAt: number;
}

export class UserSaveRepository {
  private readonly database: DatabaseConnection;

  constructor(database: DatabaseConnection) {
    this.database = database;
  }

  get(gameKey: string, gameUserId: number): StoredSaveRecord | null {
    const row = this.database.sqlite
      .prepare(
        `
          SELECT game_key, game_user_id, schema_version, save_data_json, updated_at
          FROM user_save
          WHERE game_key = ? AND game_user_id = ?
        `
      )
      .get(gameKey, gameUserId) as
      | {
          game_key: string;
          game_user_id: number;
          schema_version: number;
          save_data_json: string;
          updated_at: number;
        }
      | undefined;

    if (!row) {
      return null;
    }

    return {
      gameKey: row.game_key,
      gameUserId: row.game_user_id,
      schemaVersion: row.schema_version,
      data: JSON.parse(row.save_data_json) as Record<string, unknown>,
      updatedAt: row.updated_at
    };
  }

  put(input: {
    gameKey: string;
    gameUserId: number;
    schemaVersion: number;
    data: Record<string, unknown>;
  }): StoredSaveRecord {
    const updatedAt = Date.now();
    this.database.sqlite
      .prepare(
        `
          INSERT INTO user_save (
            game_key,
            game_user_id,
            schema_version,
            save_data_json,
            updated_at
          ) VALUES (?, ?, ?, ?, ?)
          ON CONFLICT(game_key, game_user_id)
          DO UPDATE SET
            schema_version = excluded.schema_version,
            save_data_json = excluded.save_data_json,
            updated_at = excluded.updated_at
        `
      )
      .run(input.gameKey, input.gameUserId, input.schemaVersion, JSON.stringify(input.data), updatedAt);

    const record: StoredSaveRecord = {
      gameKey: input.gameKey,
      gameUserId: input.gameUserId,
      schemaVersion: input.schemaVersion,
      data: input.data,
      updatedAt
    };

    return record;
  }
}
