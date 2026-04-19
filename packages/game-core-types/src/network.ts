export interface NetworkTransportResponse {
  status: number;
  json(): Promise<unknown>;
}

export interface NetworkTransportInit {
  method: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';
  headers: Record<string, string>;
  body?: string;
  timeoutMs?: number;
}

export type NetworkRequestImpl = (
  url: string,
  init: NetworkTransportInit
) => Promise<NetworkTransportResponse>;

export interface NetworkContext {
  baseURL: string;
  gameKey: string;
  platform: string;
  clientVersion: string;
  getToken?: () => string | undefined;
  fetchImpl?: typeof fetch;
  requestImpl?: NetworkRequestImpl;
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
