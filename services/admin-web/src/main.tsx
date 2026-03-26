import { resolveAdminRoute, adminRoutes } from './app/router.js';
import type { AdminAppSnapshot, AdminRoutePath } from './app/types.js';
import { initAdminApiClient } from './services/api-client.js';

export interface BootstrapAdminAppOptions {
  baseURL: string;
  adminToken: string;
  fetchImpl?: typeof fetch;
  gameKey: string;
  route?: AdminRoutePath;
  query?: Record<string, string | number | boolean | undefined>;
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
