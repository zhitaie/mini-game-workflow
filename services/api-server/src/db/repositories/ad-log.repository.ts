export interface AdLogRecord {
  gameKey: string;
  gameUserId: number;
  sceneKey: string;
  adType: string;
  clientTraceId: string | null;
  verificationId: string;
  verified: boolean;
  completed: boolean;
  errorCode: string | null;
  createdAt: number;
}

export class AdLogRepository {
  private nextId = 1;
  private readonly records = new Map<string, AdLogRecord>();

  create(input: Omit<AdLogRecord, 'verificationId' | 'createdAt'>): AdLogRecord {
    const verificationId = `verify-${this.nextId++}`;
    const record: AdLogRecord = {
      ...input,
      verificationId,
      createdAt: Date.now()
    };

    this.records.set(`${input.gameKey}:${verificationId}`, record);

    return record;
  }

  findByVerificationId(gameKey: string, verificationId: string): AdLogRecord | null {
    return this.records.get(`${gameKey}:${verificationId}`) ?? null;
  }

  list(filters: {
    gameKey?: string;
    gameUserId?: number;
    sceneKey?: string;
    verified?: boolean;
    completed?: boolean;
  } = {}): AdLogRecord[] {
    return [...this.records.values()]
      .filter((record) => {
        if (filters.gameKey && record.gameKey !== filters.gameKey) {
          return false;
        }

        if (filters.gameUserId !== undefined && record.gameUserId !== filters.gameUserId) {
          return false;
        }

        if (filters.sceneKey && record.sceneKey !== filters.sceneKey) {
          return false;
        }

        if (filters.verified !== undefined && record.verified !== filters.verified) {
          return false;
        }

        if (filters.completed !== undefined && record.completed !== filters.completed) {
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
