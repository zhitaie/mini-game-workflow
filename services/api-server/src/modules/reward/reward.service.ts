import { ok } from '../../common/response.js';
import type { AuthClaims } from '../../common/auth.js';
import type { DatabaseConnection } from '../../db/connection.js';
import type { AdLogRepository } from '../../db/repositories/ad-log.repository.js';
import type { RewardLogRepository } from '../../db/repositories/reward-log.repository.js';
import type { UserAssetBalanceRepository } from '../../db/repositories/user-asset-balance.repository.js';

export interface ClaimRewardInput {
  rewardType: string;
  amount: number;
  reason: string;
  bizId: string;
}

export class RewardService {
  private readonly database: DatabaseConnection;
  private readonly rewardLogRepository: RewardLogRepository;
  private readonly userAssetBalanceRepository: UserAssetBalanceRepository;
  private readonly adLogRepository: AdLogRepository;

  constructor(
    database: DatabaseConnection,
    rewardLogRepository: RewardLogRepository,
    userAssetBalanceRepository: UserAssetBalanceRepository,
    adLogRepository: AdLogRepository
  ) {
    this.database = database;
    this.rewardLogRepository = rewardLogRepository;
    this.userAssetBalanceRepository = userAssetBalanceRepository;
    this.adLogRepository = adLogRepository;
  }

  claim(claims: AuthClaims, input: ClaimRewardInput) {
    try {
      const reward = this.database.transaction(() => {
        const existing = this.rewardLogRepository.get(claims.gameKey, claims.gameUserId, input.bizId);
        if (existing) {
          return existing;
        }

        const adLog = this.adLogRepository.findByVerificationId(claims.gameKey, input.bizId);
        if (!adLog || !adLog.verified || !adLog.completed) {
          throw new Error(`Invalid verification id: ${input.bizId}`);
        }

        const balance = this.userAssetBalanceRepository.increment(
          claims.gameKey,
          claims.gameUserId,
          input.rewardType,
          input.amount
        );

        return this.rewardLogRepository.save({
          gameKey: claims.gameKey,
          gameUserId: claims.gameUserId,
          rewardType: input.rewardType,
          amount: input.amount,
          reason: input.reason,
          bizId: input.bizId,
          status: 'success',
          balanceAfter: balance.balance
        });
      });

      return ok({
        bizId: reward.bizId,
        rewardType: reward.rewardType,
        amount: reward.amount,
        balanceAfter: reward.balanceAfter,
        status: reward.status
      });
    } catch (error) {
      const existing = this.rewardLogRepository.get(claims.gameKey, claims.gameUserId, input.bizId);
      if (existing) {
        return ok({
          bizId: existing.bizId,
          rewardType: existing.rewardType,
          amount: existing.amount,
          balanceAfter: existing.balanceAfter,
          status: existing.status
        });
      }

      throw error;
    }
  }
}
