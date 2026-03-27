import { bootstrapAndRenderAdminApp } from './main.js';
import type { AdminBanner, AdminRoutePath, AdminRenderTarget } from './app/types.js';
import { loginAdmin } from './services/auth.js';
import { initAdminApiClient, setAdminApiClientToken } from './services/api-client.js';
import { archiveConfig, publishConfig, saveConfigDraft } from './services/configs.js';
import { saveNotice, setNoticeStatus } from './services/notices.js';

declare global {
  interface Window {
    __MINI_GAME_ADMIN__?: {
      baseURL?: string;
      adminToken?: string;
      adminUsername?: string;
      adminPassword?: string;
      gameKey?: string;
      containerSelector?: string;
    };
  }
}

const ADMIN_SESSION_STORAGE_KEY = 'mini-game-workflow.admin.sessionToken';

function parseHash(hash: string): {
  route: AdminRoutePath;
  query: Record<string, string>;
} {
  const cleaned = hash.startsWith('#') ? hash.slice(1) : hash;
  const [rawPath = '/dashboard', rawQuery = ''] = cleaned.split('?');
  const path = rawPath || '/dashboard';
  const knownRoutes: AdminRoutePath[] = [
    '/dashboard',
    '/users',
    '/configs',
    '/notices',
    '/ad-logs',
    '/reward-logs',
    '/analytics',
    '/audit-logs'
  ];
  const route = (knownRoutes.includes(path as AdminRoutePath) ? path : '/dashboard') as AdminRoutePath;
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

function buildQueryString(query: Record<string, string | undefined>): string {
  const params = new URLSearchParams();
  Object.entries(query).forEach(([key, value]) => {
    if (value !== undefined) {
      params.set(key, value);
    }
  });
  const raw = params.toString();
  return raw ? `?${raw}` : '';
}

export interface StartAdminBrowserAppOptions {
  baseURL?: string;
  adminToken?: string;
  adminUsername?: string;
  adminPassword?: string;
  gameKey?: string;
  target?: AdminRenderTarget;
}

export async function startAdminBrowserApp(options: StartAdminBrowserAppOptions = {}): Promise<void> {
  const bootstrap = window.__MINI_GAME_ADMIN__ ?? {};
  const target =
    options.target ??
    (document.querySelector(bootstrap.containerSelector ?? '#app') as AdminRenderTarget | null) ??
    document.body;
  const baseURL = options.baseURL ?? bootstrap.baseURL ?? 'http://localhost:3000';
  let pendingBanner: AdminBanner | undefined;

  const readRouteState = (): {
    route: AdminRoutePath;
    gameKey: string;
    query: Record<string, string>;
  } => {
    const { route, query } = parseHash(window.location.hash);
    const gameKey = query.gameKey ?? options.gameKey ?? bootstrap.gameKey ?? 'game_sample';

    return {
      route,
      gameKey,
      query
    };
  };

  const navigate = (route: AdminRoutePath, gameKey: string, query: Record<string, string | undefined>): void => {
    const normalizedQuery = Object.fromEntries(Object.entries(query).filter(([, value]) => value !== undefined)) as Record<string, string>;
    const nextHash = `#${route}${buildQueryString({
      gameKey,
      ...normalizedQuery
    })}`;

    if (window.location.hash !== nextHash) {
      window.location.hash = nextHash;
      return;
    }

    void run();
  };

  const run = async (): Promise<void> => {
    const { route, query, gameKey } = readRouteState();
    const banner = pendingBanner;
    pendingBanner = undefined;
    const ensureAdminToken = async (forceRefresh = false): Promise<string> => {
      const configuredToken = options.adminToken ?? bootstrap.adminToken;

      if (!forceRefresh && configuredToken) {
        return configuredToken;
      }

      if (!forceRefresh) {
        const storedToken = window.sessionStorage.getItem(ADMIN_SESSION_STORAGE_KEY);

        if (storedToken) {
          return storedToken;
        }
      }

      const username = options.adminUsername ?? bootstrap.adminUsername;
      const password = options.adminPassword ?? bootstrap.adminPassword;

      if (!username || !password) {
        throw new Error('Admin credentials are not configured.');
      }

      initAdminApiClient({
        baseURL,
        fetchImpl: fetch
      });
      const login = await loginAdmin({
        username,
        password
      });
      setAdminApiClientToken(login.session.token);
      window.sessionStorage.setItem(ADMIN_SESSION_STORAGE_KEY, login.session.token);
      return login.session.token;
    };

    let adminToken = await ensureAdminToken();

    try {
      await bootstrapAndRenderAdminApp({
        baseURL,
        adminToken,
        gameKey,
        route,
        query,
        banner,
        target
      });
    } catch (error) {
      if (error instanceof Error && error.message.includes('invalid admin session')) {
        window.sessionStorage.removeItem(ADMIN_SESSION_STORAGE_KEY);
        adminToken = await ensureAdminToken(true);
        await bootstrapAndRenderAdminApp({
          baseURL,
          adminToken,
          gameKey,
          route,
          query,
          banner,
          target
        });
        return;
      }

      throw error;
    }
  };

  const submitMutation = async (
    action: string,
    payload: Record<string, unknown>
  ): Promise<{
    banner: AdminBanner;
    nextQuery?: Record<string, string | undefined>;
  }> => {
    switch (action) {
      case 'config.saveDraft': {
        const result = await saveConfigDraft({
          gameKey: String(payload.gameKey ?? ''),
          platform: String(payload.platform ?? ''),
          configVersion: String(payload.configVersion ?? ''),
          minClientVersion: payload.minClientVersion ? String(payload.minClientVersion) : undefined,
          maxClientVersion: payload.maxClientVersion ? String(payload.maxClientVersion) : undefined,
          payloadJson: String(payload.payloadJson ?? '{}')
        });

        return {
          banner: {
            tone: 'success',
            message: `已保存配置草稿 ${result.item.platform}:${result.item.configVersion}`
          }
        };
      }

      case 'config.publish': {
        const result = await publishConfig({
          gameKey: String(payload.gameKey ?? ''),
          platform: String(payload.platform ?? ''),
          configVersion: String(payload.configVersion ?? '')
        });

        return {
          banner: {
            tone: 'success',
            message: `已发布配置 ${result.item.platform}:${result.item.configVersion}`
          }
        };
      }

      case 'config.archive': {
        const result = await archiveConfig({
          gameKey: String(payload.gameKey ?? ''),
          platform: String(payload.platform ?? ''),
          configVersion: String(payload.configVersion ?? '')
        });

        return {
          banner: {
            tone: 'success',
            message: `已归档配置 ${result.item.platform}:${result.item.configVersion}`
          }
        };
      }

      case 'notice.save': {
        const result = await saveNotice({
          id:
            payload.id !== undefined && payload.id !== null && String(payload.id).trim() !== ''
              ? Number(payload.id)
              : undefined,
          gameKey: String(payload.gameKey ?? ''),
          title: String(payload.title ?? ''),
          content: String(payload.content ?? ''),
          status: String(payload.status ?? 'draft') as 'draft' | 'active' | 'archived',
          startTime: payload.startTime ? String(payload.startTime) : undefined,
          endTime: payload.endTime ? String(payload.endTime) : undefined
        });

        return {
          banner: {
            tone: 'success',
            message: `已保存公告 #${result.item.id}`
          },
          nextQuery: {
            editNoticeId: undefined
          }
        };
      }

      case 'notice.setStatus': {
        const result = await setNoticeStatus({
          gameKey: String(payload.gameKey ?? ''),
          id: Number(payload.id),
          status: String(payload.status ?? 'draft') as 'draft' | 'active' | 'archived'
        });

        return {
          banner: {
            tone: 'success',
            message: `公告 #${result.item.id} 已切换为 ${result.item.status}`
          },
          nextQuery: {
            editNoticeId: undefined
          }
        };
      }

      default:
        throw new Error(`Unsupported admin action: ${action}`);
    }
  };

  if (target instanceof Element) {
    target.addEventListener('submit', (event) => {
      const form = event.target instanceof HTMLFormElement ? event.target : null;

      if (!form) {
        return;
      }

      event.preventDefault();

      const payload: Record<string, unknown> = {};
      const formData = new FormData(form);
      formData.forEach((value, key) => {
        if (typeof value === 'string') {
          payload[key] = value;
        }
      });

      const { route, gameKey, query } = readRouteState();
      const formKind = form.dataset.adminFormKind;

      if (formKind === 'query') {
        const nextRoute = (form.dataset.adminFormRoute as AdminRoutePath | undefined) ?? route;
        const nextGameKey =
          typeof payload.gameKey === 'string' && payload.gameKey.trim() ? String(payload.gameKey).trim() : gameKey;
        const nextQuery = Object.fromEntries(
          Object.entries(payload)
            .filter(([key, value]) => key !== 'gameKey' && typeof value === 'string' && value.trim() !== '')
            .map(([key, value]) => [key, String(value).trim()])
        ) as Record<string, string>;

        navigate(nextRoute, nextGameKey, nextQuery);
        return;
      }

      const action = form.dataset.adminFormAction;

      if (!action) {
        return;
      }

      void submitMutation(action, payload)
        .then((result) => {
          pendingBanner = result.banner;
          navigate(route, gameKey, {
            ...query,
            ...result.nextQuery
          });
        })
        .catch((error) => {
          pendingBanner = {
            tone: 'error',
            message: error instanceof Error ? error.message : '后台操作失败'
          };
          void run();
        });
    });

    target.addEventListener('click', (event) => {
      const rawTarget = event.target;
      const button = rawTarget instanceof Element ? rawTarget.closest<HTMLButtonElement>('[data-admin-submit-action]') : null;

      if (!button) {
        return;
      }

      const action = button.dataset.adminSubmitAction;

      if (!action) {
        return;
      }

      const confirmMessage = button.dataset.adminConfirm;
      if (confirmMessage && !window.confirm(confirmMessage)) {
        return;
      }

      event.preventDefault();

      const payload = button.dataset.adminPayload ? (JSON.parse(button.dataset.adminPayload) as Record<string, unknown>) : {};
      const { route, gameKey, query } = readRouteState();
      void submitMutation(action, payload)
        .then((result) => {
          pendingBanner = result.banner;
          navigate(route, gameKey, {
            ...query,
            ...result.nextQuery
          });
        })
        .catch((error) => {
          pendingBanner = {
            tone: 'error',
            message: error instanceof Error ? error.message : '后台操作失败'
          };
          void run();
        });
    });
  }

  window.addEventListener('hashchange', () => {
    void run();
  });

  if (!window.location.hash) {
    window.location.hash = '#/dashboard?gameKey=game_sample';
    return;
  }

  await run();
}
