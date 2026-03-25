import type { DatabaseConnection } from '../connection.js';

export interface NoticeRecord {
  id: number;
  gameKey: string;
  title: string;
  content: string;
  status: 'draft' | 'active' | 'archived';
  startTime: number | null;
  endTime: number | null;
  updatedAt: number;
}

export class NoticeRepository {
  private readonly database: DatabaseConnection;

  constructor(database: DatabaseConnection) {
    this.database = database;
  }

  create(input: Omit<NoticeRecord, 'id' | 'updatedAt'> & { updatedAt?: number }): NoticeRecord {
    const updatedAt = input.updatedAt ?? Date.now();
    const result = this.database.sqlite
      .prepare(
        `
          INSERT INTO notice (
            game_key,
            title,
            content,
            status,
            start_time,
            end_time,
            updated_at
          ) VALUES (?, ?, ?, ?, ?, ?, ?)
        `
      )
      .run(input.gameKey, input.title, input.content, input.status, input.startTime, input.endTime, updatedAt);

    const record: NoticeRecord = {
      ...input,
      id: Number(result.lastInsertRowid),
      updatedAt
    };
    return record;
  }

  list(filters: {
    gameKey?: string;
    status?: NoticeRecord['status'];
  } = {}): NoticeRecord[] {
    const conditions = ['1 = 1'];
    const values: Array<string> = [];

    if (filters.gameKey) {
      conditions.push('game_key = ?');
      values.push(filters.gameKey);
    }

    if (filters.status) {
      conditions.push('status = ?');
      values.push(filters.status);
    }

    const rows = this.database.sqlite
      .prepare(
        `
          SELECT id, game_key, title, content, status, start_time, end_time, updated_at
          FROM notice
          WHERE ${conditions.join(' AND ')}
          ORDER BY updated_at DESC
        `
      )
      .all(...values) as Array<{
      id: number;
      game_key: string;
      title: string;
      content: string;
      status: 'draft' | 'active' | 'archived';
      start_time: number | null;
      end_time: number | null;
      updated_at: number;
    }>;

    return rows.map((row) => ({
      id: row.id,
      gameKey: row.game_key,
      title: row.title,
      content: row.content,
      status: row.status,
      startTime: row.start_time,
      endTime: row.end_time,
      updatedAt: row.updated_at
    }));
  }

  listActive(gameKey: string, now = Date.now()): NoticeRecord[] {
    return this.list({
      gameKey,
      status: 'active'
    }).filter((record) => {
      if (record.startTime !== null && record.startTime > now) {
        return false;
      }

      if (record.endTime !== null && record.endTime < now) {
        return false;
      }

      return true;
    });
  }
}
