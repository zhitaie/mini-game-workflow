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
  private nextId = 1;
  private readonly records = new Map<string, GameUserRecord>();

  findOrCreate(input: {
    gameKey: string;
    platform: string;
    platformOpenId: string;
  }): { record: GameUserRecord; isNewUser: boolean } {
    const key = `${input.gameKey}:${input.platform}:${input.platformOpenId}`;
    const existing = this.records.get(key);

    if (existing) {
      existing.lastLoginAt = Date.now();
      return {
        record: existing,
        isNewUser: false
      };
    }

    const record: GameUserRecord = {
      id: this.nextId++,
      gameKey: input.gameKey,
      platform: input.platform,
      platformOpenId: input.platformOpenId,
      nickname: '',
      avatar: '',
      status: 'active',
      createdAt: Date.now(),
      lastLoginAt: Date.now()
    };

    this.records.set(key, record);

    return {
      record,
      isNewUser: true
    };
  }

  list(filters: {
    gameKey?: string;
    platform?: string;
    platformOpenId?: string;
    status?: GameUserRecord['status'];
  } = {}): GameUserRecord[] {
    return [...this.records.values()]
      .filter((record) => {
        if (filters.gameKey && record.gameKey !== filters.gameKey) {
          return false;
        }

        if (filters.platform && record.platform !== filters.platform) {
          return false;
        }

        if (filters.platformOpenId && record.platformOpenId !== filters.platformOpenId) {
          return false;
        }

        if (filters.status && record.status !== filters.status) {
          return false;
        }

        return true;
      })
      .sort((left, right) => right.id - left.id);
  }

  countCreatedSince(gameKey: string, since: number): number {
    return this.list({ gameKey }).filter((record) => record.createdAt >= since).length;
  }

  countLoggedInSince(gameKey: string, since: number): number {
    return this.list({ gameKey }).filter((record) => record.lastLoginAt >= since).length;
  }
}
