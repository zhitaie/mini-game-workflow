export interface AnalyticsEventRecord {
  gameKey: string;
  gameUserId: number | null;
  eventName: string;
  eventData: Record<string, unknown>;
  clientTime: number;
  createdAt: number;
}

export class AnalyticsEventRepository {
  private readonly records: AnalyticsEventRecord[] = [];

  append(events: AnalyticsEventRecord[]): void {
    this.records.push(...events);
  }

  list(): AnalyticsEventRecord[] {
    return [...this.records];
  }

  listByFilters(filters: {
    gameKey?: string;
    gameUserId?: number;
    eventName?: string;
  } = {}): AnalyticsEventRecord[] {
    return this.records
      .filter((record) => {
        if (filters.gameKey && record.gameKey !== filters.gameKey) {
          return false;
        }

        if (filters.gameUserId !== undefined && record.gameUserId !== filters.gameUserId) {
          return false;
        }

        if (filters.eventName && record.eventName !== filters.eventName) {
          return false;
        }

        return true;
      })
      .slice()
      .sort((left, right) => right.createdAt - left.createdAt);
  }

  countSince(gameKey: string, since: number): number {
    return this.listByFilters({ gameKey }).filter((record) => record.createdAt >= since).length;
  }
}
