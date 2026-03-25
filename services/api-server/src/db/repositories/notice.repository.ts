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
  private nextId = 1;
  private readonly records: NoticeRecord[] = [];

  create(input: Omit<NoticeRecord, 'id' | 'updatedAt'> & { updatedAt?: number }): NoticeRecord {
    const record: NoticeRecord = {
      ...input,
      id: this.nextId++,
      updatedAt: input.updatedAt ?? Date.now()
    };

    this.records.push(record);
    return record;
  }

  list(filters: {
    gameKey?: string;
    status?: NoticeRecord['status'];
  } = {}): NoticeRecord[] {
    return this.records
      .filter((record) => {
        if (filters.gameKey && record.gameKey !== filters.gameKey) {
          return false;
        }

        if (filters.status && record.status !== filters.status) {
          return false;
        }

        return true;
      })
      .sort((left, right) => right.updatedAt - left.updatedAt);
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
