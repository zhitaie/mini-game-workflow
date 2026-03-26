import type { AdminItemResult, AdminListResult, AdminNoticeItem } from '@mini-game-workflow/game-core-types';
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

export interface SaveNoticeInput {
  id?: number;
  gameKey: string;
  title: string;
  content: string;
  status: 'draft' | 'active' | 'archived';
  startTime?: string;
  endTime?: string;
}

export interface SetNoticeStatusInput {
  id: number;
  status: 'draft' | 'active' | 'archived';
}

function normalizeOptionalDatetime(value?: string): string | null {
  if (!value) {
    return null;
  }

  const timestamp = Date.parse(value);

  if (Number.isNaN(timestamp)) {
    throw new Error('公告时间格式无效。');
  }

  return new Date(timestamp).toISOString();
}

export async function saveNotice(input: SaveNoticeInput): Promise<AdminItemResult<AdminNoticeItem>> {
  return request<AdminItemResult<AdminNoticeItem>>('/api/admin/notices/save', {
    method: 'POST',
    body: {
      id: input.id,
      gameKey: input.gameKey,
      title: input.title,
      content: input.content,
      status: input.status,
      startTime: normalizeOptionalDatetime(input.startTime),
      endTime: normalizeOptionalDatetime(input.endTime)
    }
  });
}

export async function setNoticeStatus(input: SetNoticeStatusInput): Promise<AdminItemResult<AdminNoticeItem>> {
  return request<AdminItemResult<AdminNoticeItem>>('/api/admin/notices/status', {
    method: 'POST',
    body: input
  });
}
