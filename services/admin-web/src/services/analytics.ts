import type { AdminAnalyticsEventItem, AdminListResult } from '@mini-game-workflow/game-core-types';
import { request } from './api-client.js';

export interface FetchAnalyticsEventsParams {
  gameKey?: string;
  gameUserId?: number;
  eventName?: string;
}

export async function fetchAnalyticsEvents(
  params: FetchAnalyticsEventsParams = {}
): Promise<AdminListResult<AdminAnalyticsEventItem>> {
  return request<AdminListResult<AdminAnalyticsEventItem>>('/api/admin/analytics', {
    query: params
  });
}
