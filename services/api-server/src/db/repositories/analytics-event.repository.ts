import type { DatabaseConnection } from '../connection.js';

export interface AnalyticsEventRecord {
  gameKey: string;
  gameUserId: number | null;
  eventName: string;
  eventData: Record<string, unknown>;
  clientTime: number;
  createdAt: number;
}

export class AnalyticsEventRepository {
  private readonly database: DatabaseConnection;

  constructor(database: DatabaseConnection) {
    this.database = database;
  }

  append(events: AnalyticsEventRecord[]): void {
    const insert = this.database.sqlite.prepare(
      `
        INSERT INTO analytics_event (
          game_key,
          game_user_id,
          event_name,
          event_data_json,
          client_time,
          created_at
        ) VALUES (?, ?, ?, ?, ?, ?)
      `
    );

    this.database.transaction(() => {
      events.forEach((event) => {
        insert.run(
          event.gameKey,
          event.gameUserId,
          event.eventName,
          JSON.stringify(event.eventData),
          event.clientTime,
          event.createdAt
        );
      });
    });
  }

  list(): AnalyticsEventRecord[] {
    return this.listByFilters();
  }

  listByFilters(filters: {
    gameKey?: string;
    gameUserId?: number;
    eventName?: string;
  } = {}): AnalyticsEventRecord[] {
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

    if (filters.eventName) {
      conditions.push('event_name = ?');
      values.push(filters.eventName);
    }

    const rows = this.database.sqlite
      .prepare(
        `
          SELECT game_key, game_user_id, event_name, event_data_json, client_time, created_at
          FROM analytics_event
          WHERE ${conditions.join(' AND ')}
          ORDER BY created_at DESC
        `
      )
      .all(...values) as Array<{
      game_key: string;
      game_user_id: number | null;
      event_name: string;
      event_data_json: string;
      client_time: number;
      created_at: number;
    }>;

    return rows.map((row) => ({
      gameKey: row.game_key,
      gameUserId: row.game_user_id,
      eventName: row.event_name,
      eventData: JSON.parse(row.event_data_json) as Record<string, unknown>,
      clientTime: row.client_time,
      createdAt: row.created_at
    }));
  }

  countSince(gameKey: string, since: number): number {
    const row = this.database.sqlite
      .prepare(
        `
          SELECT COUNT(*) AS count
          FROM analytics_event
          WHERE game_key = ? AND created_at >= ?
        `
      )
      .get(gameKey, since) as { count: number };

    return row.count;
  }
}
