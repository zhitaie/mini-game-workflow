import { ok } from '../../common/response';

export class RewardService {
  claim(rewardType: string, amount: number, bizId: string) {
    return ok({
      bizId,
      rewardType,
      amount,
      balanceAfter: amount,
      status: 'success'
    });
  }
}

