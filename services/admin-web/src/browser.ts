import { bootstrapAndRenderAdminApp } from './main.js';
import type { AdminRoutePath, AdminRenderTarget } from './app/types.js';

declare global {
  interface Window {
    __MINI_GAME_ADMIN__?: {
      baseURL?: string;
      adminToken?: string;
      gameKey?: string;
      containerSelector?: string;
    };
  }
}

function parseHash(hash: string): {
  route: AdminRoutePath;
  query: Record<string, string>;
} {
  const cleaned = hash.startsWith('#') ? hash.slice(1) : hash;
  const [rawPath = '/dashboard', rawQuery = ''] = cleaned.split('?');
  const path = rawPath || '/dashboard';
  const route = (
    ['/dashboard', '/users', '/configs', '/notices', '/ad-logs', '/reward-logs', '/analytics'].includes(path)
      ? path
      : '/dashboard'
  ) as AdminRoutePath;
  const params = new URLSearchParams(rawQuery);
  const query: Record<string, string> = {};
  params.forEach((value, key) => {
    query[key] = value;
  });

  return {
    route,
    query
  };
}

export interface StartAdminBrowserAppOptions {
  baseURL?: string;
  adminToken?: string;
  gameKey?: string;
  target?: AdminRenderTarget;
}

export async function startAdminBrowserApp(options: StartAdminBrowserAppOptions = {}): Promise<void> {
  const bootstrap = window.__MINI_GAME_ADMIN__ ?? {};
  const target =
    options.target ??
    (document.querySelector(bootstrap.containerSelector ?? '#app') as AdminRenderTarget | null) ??
    document.body;

  const run = async (): Promise<void> => {
    const { route, query } = parseHash(window.location.hash);
    const gameKey = query.gameKey ?? options.gameKey ?? bootstrap.gameKey ?? 'game_sample';

    await bootstrapAndRenderAdminApp({
      baseURL: options.baseURL ?? bootstrap.baseURL ?? 'http://localhost:3000',
      adminToken: options.adminToken ?? bootstrap.adminToken ?? 'dev-admin-token',
      gameKey,
      route,
      query,
      target
    });
  };

  window.addEventListener('hashchange', () => {
    void run();
  });

  if (!window.location.hash) {
    window.location.hash = '#/dashboard?gameKey=game_sample';
    return;
  }

  await run();
}
