import type { AdminAdLogItem, AdminListResult } from '@mini-game-workflow/game-core-types';
import { request } from './api-client.js';

export interface FetchAdLogsParams {
  gameKey?: string;
  gameUserId?: number;
  sceneKey?: string;
  verified?: boolean;
  completed?: boolean;
}

export async function fetchAdLogs(params: FetchAdLogsParams = {}): Promise<AdminListResult<AdminAdLogItem>> {
  return request<AdminListResult<AdminAdLogItem>>('/api/admin/ad-logs', {
    query: params
  });
}
