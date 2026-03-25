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

export class GameConfigRepository {
  private readonly records = new Map<string, GameConfigRecord>();

  setActive(record: Omit<GameConfigRecord, 'status' | 'updatedAt'> & { updatedAt?: number }): void {
    const key = `${record.gameKey}:${record.platform}`;
    this.records.set(key, {
      ...record,
      status: 'active',
      updatedAt: record.updatedAt ?? Date.now()
    });
  }

  findActive(gameKey: string, platform: string): GameConfigRecord | null {
    return this.records.get(`${gameKey}:${platform}`) ?? null;
  }

  list(filters: {
    gameKey?: string;
    platform?: string;
    status?: GameConfigRecord['status'];
  } = {}): GameConfigRecord[] {
    return [...this.records.values()]
      .filter((record) => {
        if (filters.gameKey && record.gameKey !== filters.gameKey) {
          return false;
        }

        if (filters.platform && record.platform !== filters.platform) {
          return false;
        }

        if (filters.status && record.status !== filters.status) {
          return false;
        }

        return true;
      })
      .sort((left, right) => right.updatedAt - left.updatedAt);
  }
}
