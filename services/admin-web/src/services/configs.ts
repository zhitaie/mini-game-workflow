import type { AdminConfigItem, AdminItemResult, AdminListResult } from '@mini-game-workflow/game-core-types';
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

export interface SaveConfigDraftInput {
  gameKey: string;
  platform: string;
  configVersion: string;
  minClientVersion?: string;
  maxClientVersion?: string;
  payloadJson: string;
}

export interface PublishConfigInput {
  gameKey: string;
  platform: string;
  configVersion: string;
}

export interface ArchiveConfigInput {
  gameKey: string;
  platform: string;
  configVersion: string;
}

function parsePayload(payloadJson: string): Record<string, unknown> {
  const parsed = JSON.parse(payloadJson || '{}') as unknown;

  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
    throw new Error('配置 payload 必须是 JSON 对象。');
  }

  return parsed as Record<string, unknown>;
}

export async function saveConfigDraft(input: SaveConfigDraftInput): Promise<AdminItemResult<AdminConfigItem>> {
  return request<AdminItemResult<AdminConfigItem>>('/api/admin/configs/draft', {
    method: 'POST',
    body: {
      gameKey: input.gameKey,
      platform: input.platform,
      configVersion: input.configVersion,
      minClientVersion: input.minClientVersion || undefined,
      maxClientVersion: input.maxClientVersion || undefined,
      payload: parsePayload(input.payloadJson)
    }
  });
}

export async function publishConfig(input: PublishConfigInput): Promise<AdminItemResult<AdminConfigItem>> {
  return request<AdminItemResult<AdminConfigItem>>('/api/admin/configs/publish', {
    method: 'POST',
    body: input
  });
}

export async function archiveConfig(input: ArchiveConfigInput): Promise<AdminItemResult<AdminConfigItem>> {
  return request<AdminItemResult<AdminConfigItem>>('/api/admin/configs/archive', {
    method: 'POST',
    body: input
  });
}
