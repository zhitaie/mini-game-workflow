export interface StoredSaveRecord {
  gameKey: string;
  gameUserId: number;
  schemaVersion: number;
  data: Record<string, unknown>;
  updatedAt: number;
}

export class UserSaveRepository {
  private readonly records = new Map<string, StoredSaveRecord>();

  get(gameKey: string, gameUserId: number): StoredSaveRecord | null {
    return this.records.get(`${gameKey}:${gameUserId}`) ?? null;
  }

  put(input: {
    gameKey: string;
    gameUserId: number;
    schemaVersion: number;
    data: Record<string, unknown>;
  }): StoredSaveRecord {
    const record: StoredSaveRecord = {
      gameKey: input.gameKey,
      gameUserId: input.gameUserId,
      schemaVersion: input.schemaVersion,
      data: input.data,
      updatedAt: Date.now()
    };

    this.records.set(`${input.gameKey}:${input.gameUserId}`, record);

    return record;
  }
}
