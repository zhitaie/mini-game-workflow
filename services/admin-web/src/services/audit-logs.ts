import type { AdminAuditLogItem, AdminListResult } from '@mini-game-workflow/game-core-types';
import { request } from './api-client.js';

export interface FetchAuditLogsParams {
  gameKey?: string;
  adminUserId?: number;
  action?: string;
  targetType?: string;
}

export async function fetchAuditLogs(params: FetchAuditLogsParams = {}): Promise<AdminListResult<AdminAuditLogItem>> {
  return request<AdminListResult<AdminAuditLogItem>>('/api/admin/audit-logs', {
    query: params
  });
}
