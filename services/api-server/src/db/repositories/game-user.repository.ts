export interface GameUserRecord {
  id: number;
  gameKey: string;
  platform: string;
  platformOpenId: string;
  nickname: string;
  avatar: string;
  status: 'active';
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
      lastLoginAt: Date.now()
    };

    this.records.set(key, record);

    return {
      record,
      isNewUser: true
    };
  }
}
