import type { AdminListResult, AdminNoticeItem } from '@mini-game-workflow/game-core-types';
import { request } from './api-client.js';

export interface FetchNoticesParams {
  gameKey?: string;
  status?: 'draft' | 'active' | 'archived';
}

export async function fetchNotices(params: FetchNoticesParams = {}): Promise<AdminListResult<AdminNoticeItem>> {
  return request<AdminListResult<AdminNoticeItem>>('/api/admin/notices', {
    query: params
  });
}
