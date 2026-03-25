export interface UserAssetBalanceRecord {
  gameKey: string;
  gameUserId: number;
  assetType: string;
  balance: number;
  updatedAt: number;
}

export class UserAssetBalanceRepository {
  private readonly records = new Map<string, UserAssetBalanceRecord>();

  increment(gameKey: string, gameUserId: number, assetType: string, amount: number): UserAssetBalanceRecord {
    const key = `${gameKey}:${gameUserId}:${assetType}`;
    const existing = this.records.get(key);
    const nextBalance = (existing?.balance ?? 0) + amount;
    const record: UserAssetBalanceRecord = {
      gameKey,
      gameUserId,
      assetType,
      balance: nextBalance,
      updatedAt: Date.now()
    };

    this.records.set(key, record);
    return record;
  }

  get(gameKey: string, gameUserId: number, assetType: string): UserAssetBalanceRecord | null {
    return this.records.get(`${gameKey}:${gameUserId}:${assetType}`) ?? null;
  }
}
