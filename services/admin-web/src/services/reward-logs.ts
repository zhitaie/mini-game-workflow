import type { AdminListResult, AdminRewardLogItem } from '@mini-game-workflow/game-core-types';
import { request } from './api-client.js';

export interface FetchRewardLogsParams {
  gameKey?: string;
  gameUserId?: number;
  rewardType?: string;
  reason?: string;
  bizId?: string;
}

export async function fetchRewardLogs(params: FetchRewardLogsParams = {}): Promise<AdminListResult<AdminRewardLogItem>> {
  return request<AdminListResult<AdminRewardLogItem>>('/api/admin/reward-logs', {
    query: params
  });
}
