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

  findById(id: number): NoticeRecord | null {
    const row = this.database.sqlite
      .prepare(
        `
          SELECT id, game_key, title, content, status, start_time, end_time, updated_at
          FROM notice
          WHERE id = ?
          LIMIT 1
        `
      )
      .get(id) as NoticeRow | undefined;

    return row ? this.mapRow(row) : null;
  }

  update(input: Omit<NoticeRecord, 'updatedAt'> & { updatedAt?: number }): NoticeRecord | null {
    const updatedAt = input.updatedAt ?? Date.now();
    const result = this.database.sqlite
      .prepare(
        `
          UPDATE notice
          SET
            title = ?,
            content = ?,
            status = ?,
            start_time = ?,
            end_time = ?,
            updated_at = ?
          WHERE id = ?
        `
      )
      .run(input.title, input.content, input.status, input.startTime, input.endTime, updatedAt, input.id);

    if (result.changes === 0) {
      return null;
    }

    return {
      ...input,
      updatedAt
    };
  }

  setStatus(id: number, status: NoticeRecord['status'], updatedAt = Date.now()): NoticeRecord | null {
    const result = this.database.sqlite
      .prepare(
        `
          UPDATE notice
          SET status = ?, updated_at = ?
          WHERE id = ?
        `
      )
      .run(status, updatedAt, id);

    if (result.changes === 0) {
      return null;
    }

    return this.findById(id);
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
      .all(...values) as NoticeRow[];

    return rows.map((row) => this.mapRow(row));
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

  private mapRow(row: NoticeRow): NoticeRecord {
    return {
      id: row.id,
      gameKey: row.game_key,
      title: row.title,
      content: row.content,
      status: row.status,
      startTime: row.start_time,
      endTime: row.end_time,
      updatedAt: row.updated_at
    };
  }
}

interface NoticeRow {
  id: number;
  game_key: string;
  title: string;
  content: string;
  status: 'draft' | 'active' | 'archived';
  start_time: number | null;
  end_time: number | null;
  updated_at: number;
}
