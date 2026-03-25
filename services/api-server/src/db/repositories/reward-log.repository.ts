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
  private readonly records = new Map<string, RewardLogRecord>();

  get(gameKey: string, gameUserId: number, bizId: string): RewardLogRecord | null {
    return this.records.get(`${gameKey}:${gameUserId}:${bizId}`) ?? null;
  }

  save(record: Omit<RewardLogRecord, 'createdAt'>): RewardLogRecord {
    const fullRecord: RewardLogRecord = {
      ...record,
      createdAt: Date.now()
    };

    this.records.set(`${record.gameKey}:${record.gameUserId}:${record.bizId}`, fullRecord);
    return fullRecord;
  }

  list(filters: {
    gameKey?: string;
    gameUserId?: number;
    rewardType?: string;
    reason?: string;
    bizId?: string;
  } = {}): RewardLogRecord[] {
    return [...this.records.values()]
      .filter((record) => {
        if (filters.gameKey && record.gameKey !== filters.gameKey) {
          return false;
        }

        if (filters.gameUserId !== undefined && record.gameUserId !== filters.gameUserId) {
          return false;
        }

        if (filters.rewardType && record.rewardType !== filters.rewardType) {
          return false;
        }

        if (filters.reason && record.reason !== filters.reason) {
          return false;
        }

        if (filters.bizId && record.bizId !== filters.bizId) {
          return false;
        }

        return true;
      })
      .sort((left, right) => right.createdAt - left.createdAt);
  }

  countSince(gameKey: string, since: number): number {
    return this.list({ gameKey }).filter((record) => record.createdAt >= since).length;
  }
}
