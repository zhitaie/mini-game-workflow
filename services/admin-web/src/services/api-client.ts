import type { ApiResponse } from '@mini-game-workflow/game-core-types';

export interface AdminApiClientContext {
  baseURL: string;
  adminToken?: string;
  fetchImpl?: typeof fetch;
}

export interface AdminRequestOptions {
  method?: 'GET' | 'POST';
  query?: object;
  body?: unknown;
  requiresAuth?: boolean;
}

let context: AdminApiClientContext | null = null;

function buildURL(baseURL: string, path: string, query?: object): string {
  const url = new URL(path, baseURL);

  if (query) {
    Object.entries(query as Record<string, unknown>).forEach(([key, value]) => {
      if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') {
        url.searchParams.set(key, String(value));
      }
    });
  }

  return url.toString();
}

export function initAdminApiClient(nextContext: AdminApiClientContext): void {
  context = nextContext;
}

export function setAdminApiClientToken(adminToken: string | undefined): void {
  if (!context) {
    throw new Error('Admin API client is not initialized.');
  }

  context = {
    ...context,
    adminToken
  };
}

export async function request<TData>(path: string, options: AdminRequestOptions = {}): Promise<TData> {
  if (!context) {
    throw new Error('Admin API client is not initialized.');
  }

  if (options.requiresAuth !== false && !context.adminToken) {
    throw new Error('Admin session token is missing.');
  }

  const fetchImpl = context.fetchImpl ?? fetch;
  const headers: Record<string, string> = {
    'Content-Type': 'application/json'
  };

  if (context.adminToken) {
    headers['x-admin-token'] = context.adminToken;
  }

  const response = await fetchImpl(buildURL(context.baseURL, path, options.query), {
    method: options.method ?? 'GET',
    headers,
    body: options.body === undefined ? undefined : JSON.stringify(options.body)
  });

  const payload = (await response.json()) as ApiResponse<TData>;

  if (!payload.success) {
    throw new Error(payload.message || payload.code);
  }

  return payload.data;
}
