import type { ApiResponse, NetworkContext, NetworkRequestOptions } from '@mini-game-workflow/game-core-types';
import { NetworkBusinessError, type NetworkManager } from './NetworkManager.js';

function buildURL(baseURL: string, path: string, query?: Record<string, string | number | boolean | undefined>): string {
  const url = new URL(path, baseURL);

  if (query) {
    Object.entries(query).forEach(([key, value]) => {
      if (value !== undefined) {
        url.searchParams.set(key, String(value));
      }
    });
  }

  return url.toString();
}

export function createNetworkManager(): NetworkManager {
  let context: NetworkContext | null = null;

  return {
    init(nextContext: NetworkContext): void {
      context = nextContext;
    },
    async request<TData>(options: NetworkRequestOptions): Promise<TData> {
      if (!context) {
        throw new Error('NetworkManager has not been initialized.');
      }

      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
        ...options.headers
      };

      if (options.requiresAuth) {
        const token = context.getToken?.();
        if (!token) {
          throw new NetworkBusinessError('missing auth token', 'UNAUTHORIZED', null);
        }
        headers.Authorization = `Bearer ${token}`;
      }

      const url = buildURL(context.baseURL, options.path, options.query);
      const body = options.body === undefined ? undefined : JSON.stringify(options.body);
      const response = context.requestImpl
        ? await context.requestImpl(url, {
            method: options.method,
            headers,
            body,
            timeoutMs: options.timeoutMs
          })
        : await (context.fetchImpl ?? fetch)(url, {
            method: options.method,
            headers,
            body
          });

      const payload = (await response.json()) as ApiResponse<TData>;

      if (!payload.success) {
        throw new NetworkBusinessError(payload.message, payload.code, payload.data);
      }

      return payload.data;
    }
  };
}
