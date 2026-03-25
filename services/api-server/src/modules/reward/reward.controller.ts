import { RewardService } from './reward.service.js';

export function createRewardController(service: RewardService): RewardService {
  return service;
}
