import type { AdminGameUserItem, AdminListResult } from '@mini-game-workflow/game-core-types';
import { request } from './api-client.js';

export interface FetchUsersParams {
  gameKey?: string;
  platform?: string;
  platformOpenId?: string;
  status?: 'active';
}

export async function fetchUsers(params: FetchUsersParams = {}): Promise<AdminListResult<AdminGameUserItem>> {
  return request<AdminListResult<AdminGameUserItem>>('/api/admin/users', {
    query: params
  });
}
