export interface NetworkContext {
  baseURL: string;
  gameKey: string;
  platform: string;
  clientVersion: string;
  getToken?: () => string | undefined;
}

export interface NetworkRequestOptions {
  path: string;
  method: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';
  query?: Record<string, string | number | boolean | undefined>;
  body?: unknown;
  headers?: Record<string, string>;
  requiresAuth?: boolean;
  timeoutMs?: number;
}

