import { resolveAdminRoute, adminRoutes } from './app/router.js';
import { mountAdminSnapshot } from './app/render.js';
import type { AdminAppSnapshot, AdminBanner, AdminRenderResult, AdminRenderTarget, AdminRoutePath } from './app/types.js';
import { initAdminApiClient } from './services/api-client.js';

export interface BootstrapAdminAppOptions {
  baseURL: string;
  adminToken: string;
  fetchImpl?: typeof fetch;
  gameKey: string;
  route?: AdminRoutePath;
  query?: Record<string, string | number | boolean | undefined>;
  banner?: AdminBanner;
  target?: AdminRenderTarget;
}

export async function bootstrapAdminApp(options: BootstrapAdminAppOptions): Promise<AdminAppSnapshot> {
  initAdminApiClient({
    baseURL: options.baseURL,
    adminToken: options.adminToken,
    fetchImpl: options.fetchImpl
  });

  const currentRoute = options.route ?? '/dashboard';
  const route = resolveAdminRoute(currentRoute);
  const page = await route.load({
    gameKey: options.gameKey,
    query: options.query
  });

  if (options.banner) {
    page.banner = options.banner;
  }

  return {
    gameKey: options.gameKey,
    currentRoute,
    navigation: adminRoutes.map((item) => ({
      path: item.path,
      label: item.label,
      description: item.description
    })),
    page
  };
}

export async function bootstrapAndRenderAdminApp(options: BootstrapAdminAppOptions): Promise<AdminRenderResult> {
  const snapshot = await bootstrapAdminApp(options);
  const html = options.target ? mountAdminSnapshot(options.target, snapshot) : mountAdminSnapshot({ innerHTML: '' }, snapshot);

  return {
    snapshot,
    html
  };
}
