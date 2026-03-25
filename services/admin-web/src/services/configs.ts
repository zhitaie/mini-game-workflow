import type { AdminConfigItem, AdminListResult } from '@mini-game-workflow/game-core-types';
import { request } from './api-client.js';

export interface FetchConfigsParams {
  gameKey?: string;
  platform?: string;
  status?: 'draft' | 'active' | 'archived';
}

export async function fetchConfigs(params: FetchConfigsParams = {}): Promise<AdminListResult<AdminConfigItem>> {
  return request<AdminListResult<AdminConfigItem>>('/api/admin/configs', {
    query: params
  });
}
