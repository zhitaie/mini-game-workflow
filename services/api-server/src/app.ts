import { decodeToken, type AuthClaims } from './common/auth.js';
import { DEV_ADMIN_TOKEN } from './common/admin.js';
import { errorCodes } from './common/errors.js';
import { fail } from './common/response.js';
import { AdLogRepository } from './db/repositories/ad-log.repository.js';
import { AnalyticsEventRepository } from './db/repositories/analytics-event.repository.js';
import { GameConfigRepository } from './db/repositories/game-config.repository.js';
import { GameUserRepository } from './db/repositories/game-user.repository.js';
import { NoticeRepository } from './db/repositories/notice.repository.js';
import { RewardLogRepository } from './db/repositories/reward-log.repository.js';
import { UserAssetBalanceRepository } from './db/repositories/user-asset-balance.repository.js';
import { UserSaveRepository } from './db/repositories/user-save.repository.js';
import { AdService } from './modules/ad/ad.service.js';
import { AdminService } from './modules/admin/admin.service.js';
import { AnalyticsService } from './modules/analytics/analytics.service.js';
import { AuthService } from './modules/auth/auth.service.js';
import { ConfigService } from './modules/config/config.service.js';
import { NoticeService } from './modules/notice/notice.service.js';
import { RewardService } from './modules/reward/reward.service.js';
import { SaveService } from './modules/save/save.service.js';

class AppError extends Error {
  readonly code: string;

  constructor(code: string, message: string) {
    super(message);
    this.code = code;
  }
}

function json(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      'Content-Type': 'application/json'
    }
  });
}

function readToken(headers: HeadersInit | undefined): string | null {
  if (!headers) {
    return null;
  }

  const normalized = new Headers(headers);
  const authorization = normalized.get('Authorization');

  if (!authorization) {
    return null;
  }

  return authorization.replace(/^Bearer\s+/u, '');
}

function requireAuth(headers: HeadersInit | undefined): AuthClaims {
  const token = readToken(headers);

  if (!token) {
    throw new AppError(errorCodes.UNAUTHORIZED, 'missing token');
  }

  return decodeToken(token);
}

function optionalAuth(headers: HeadersInit | undefined): AuthClaims | null {
  const token = readToken(headers);
  return token ? decodeToken(token) : null;
}

function requireAdmin(headers: HeadersInit | undefined): void {
  const normalized = new Headers(headers);
  const token = normalized.get('x-admin-token');

  if (token !== DEV_ADMIN_TOKEN) {
    throw new AppError(errorCodes.FORBIDDEN, 'invalid admin token');
  }
}

function parseBody(init?: RequestInit): Record<string, unknown> {
  if (!init?.body) {
    return {};
  }

  if (typeof init.body === 'string') {
    return JSON.parse(init.body) as Record<string, unknown>;
  }

  throw new AppError(errorCodes.BAD_REQUEST, 'unsupported request body');
}

export interface ApiApp {
  name: string;
  fetch(input: RequestInfo | URL, init?: RequestInit): Promise<Response>;
}

export function createApp(): ApiApp {
  const analyticsEventRepository = new AnalyticsEventRepository();
  const adLogRepository = new AdLogRepository();
  const gameUserRepository = new GameUserRepository();
  const gameConfigRepository = new GameConfigRepository();
  const noticeRepository = new NoticeRepository();
  const rewardLogRepository = new RewardLogRepository();
  const userAssetBalanceRepository = new UserAssetBalanceRepository();
  const userSaveRepository = new UserSaveRepository();

  gameConfigRepository.setActive({
    gameKey: 'game_sample',
    platform: 'web',
    configVersion: 'seed-web-v1',
    minClientVersion: '0.1.0',
    maxClientVersion: '0.9.99',
    payload: {
      ad: {
        enabled: false
      }
    }
  });

  noticeRepository.create({
    gameKey: 'game_sample',
    title: '欢迎来到样例游戏',
    content: '这是一条用于联调公告链路的默认公告。',
    status: 'active',
    startTime: null,
    endTime: null
  });

  const adService = new AdService(adLogRepository);
  const adminService = new AdminService(
    gameUserRepository,
    gameConfigRepository,
    noticeRepository,
    adLogRepository,
    rewardLogRepository,
    analyticsEventRepository
  );
  const analyticsService = new AnalyticsService(analyticsEventRepository);
  const authService = new AuthService(gameUserRepository);
  const configService = new ConfigService(gameConfigRepository);
  const noticeService = new NoticeService(noticeRepository);
  const rewardService = new RewardService(rewardLogRepository, userAssetBalanceRepository, adLogRepository);
  const saveService = new SaveService(userSaveRepository);

  return {
    name: 'api-server',
    async fetch(input: RequestInfo | URL, init?: RequestInit): Promise<Response> {
      try {
        const rawUrl =
          typeof input === 'string'
            ? input
            : input instanceof URL
              ? input.toString()
              : input.url;

        const url = new URL(rawUrl, 'http://local.app');
        const method = init?.method ?? 'GET';

        if (url.pathname === '/api/auth/login' && method === 'POST') {
          const body = parseBody(init);
          return json(
            authService.login({
              gameKey: String(body.gameKey ?? ''),
              platform: String(body.platform ?? ''),
              code: String(body.code ?? ''),
              clientVersion: String(body.clientVersion ?? '')
            })
          );
        }

        if (url.pathname === '/api/config' && method === 'GET') {
          return json(
            configService.getConfig(
              String(url.searchParams.get('gameKey') ?? ''),
              String(url.searchParams.get('platform') ?? ''),
              String(url.searchParams.get('clientVersion') ?? '')
            )
          );
        }

        if (url.pathname === '/api/notice' && method === 'GET') {
          return json(noticeService.list(String(url.searchParams.get('gameKey') ?? '')));
        }

        if (url.pathname === '/api/save' && method === 'GET') {
          return json(saveService.getSave(requireAuth(init?.headers)));
        }

        if (url.pathname === '/api/save' && method === 'POST') {
          const claims = requireAuth(init?.headers);
          const body = parseBody(init);
          return json(
            saveService.replaceSave(claims, {
              save: {
                schemaVersion: Number((body.save as { schemaVersion?: number } | undefined)?.schemaVersion ?? 1),
                data: ((body.save as { data?: Record<string, unknown> } | undefined)?.data ?? {}) as Record<string, unknown>
              }
            })
          );
        }

        if (url.pathname === '/api/analytics/events' && method === 'POST') {
          const body = parseBody(init);
          return json(
            analyticsService.accept(
              {
                gameKey: String(body.gameKey ?? ''),
                platform: String(body.platform ?? ''),
                clientVersion: String(body.clientVersion ?? ''),
                sessionId: String(body.sessionId ?? ''),
                events: Array.isArray(body.events) ? (body.events as Array<{ eventName: string; eventData?: Record<string, unknown>; clientTime?: number }>) : []
              },
              optionalAuth(init?.headers)
            )
          );
        }

        if (url.pathname === '/api/ad/verify' && method === 'POST') {
          const claims = requireAuth(init?.headers);
          const body = parseBody(init);
          return json(
            adService.verify(claims, {
              sceneKey: String(body.sceneKey ?? ''),
              adType: String(body.adType ?? ''),
              clientTraceId: body.clientTraceId ? String(body.clientTraceId) : undefined,
              platformResult:
                typeof body.platformResult === 'object' && body.platformResult
                  ? {
                      completed: Boolean((body.platformResult as { completed?: boolean }).completed)
                    }
                  : undefined
            })
          );
        }

        if (url.pathname === '/api/reward/claim' && method === 'POST') {
          const claims = requireAuth(init?.headers);
          const body = parseBody(init);
          return json(
            rewardService.claim(claims, {
              rewardType: String(body.rewardType ?? ''),
              amount: Number(body.amount ?? 0),
              reason: String(body.reason ?? ''),
              bizId: String(body.bizId ?? '')
            })
          );
        }

        if (url.pathname === '/api/admin/dashboard' && method === 'GET') {
          requireAdmin(init?.headers);
          return json(adminService.getDashboardSummary(String(url.searchParams.get('gameKey') ?? '')));
        }

        if (url.pathname === '/api/admin/users' && method === 'GET') {
          requireAdmin(init?.headers);
          return json(
            adminService.listUsers({
              gameKey: url.searchParams.get('gameKey') ?? undefined,
              platform: url.searchParams.get('platform') ?? undefined,
              platformOpenId: url.searchParams.get('platformOpenId') ?? undefined,
              status: (url.searchParams.get('status') as 'active' | null) ?? undefined
            })
          );
        }

        if (url.pathname === '/api/admin/configs' && method === 'GET') {
          requireAdmin(init?.headers);
          return json(
            adminService.listConfigs({
              gameKey: url.searchParams.get('gameKey') ?? undefined,
              platform: url.searchParams.get('platform') ?? undefined,
              status: (url.searchParams.get('status') as 'draft' | 'active' | 'archived' | null) ?? undefined
            })
          );
        }

        if (url.pathname === '/api/admin/notices' && method === 'GET') {
          requireAdmin(init?.headers);
          return json(
            adminService.listNotices({
              gameKey: url.searchParams.get('gameKey') ?? undefined,
              status: (url.searchParams.get('status') as 'draft' | 'active' | 'archived' | null) ?? undefined
            })
          );
        }

        if (url.pathname === '/api/admin/ad-logs' && method === 'GET') {
          requireAdmin(init?.headers);
          return json(
            adminService.listAdLogs({
              gameKey: url.searchParams.get('gameKey') ?? undefined,
              gameUserId: url.searchParams.get('gameUserId') ? Number(url.searchParams.get('gameUserId')) : undefined,
              sceneKey: url.searchParams.get('sceneKey') ?? undefined,
              verified: url.searchParams.get('verified') ? url.searchParams.get('verified') === 'true' : undefined,
              completed: url.searchParams.get('completed') ? url.searchParams.get('completed') === 'true' : undefined
            })
          );
        }

        if (url.pathname === '/api/admin/reward-logs' && method === 'GET') {
          requireAdmin(init?.headers);
          return json(
            adminService.listRewardLogs({
              gameKey: url.searchParams.get('gameKey') ?? undefined,
              gameUserId: url.searchParams.get('gameUserId') ? Number(url.searchParams.get('gameUserId')) : undefined,
              rewardType: url.searchParams.get('rewardType') ?? undefined,
              reason: url.searchParams.get('reason') ?? undefined,
              bizId: url.searchParams.get('bizId') ?? undefined
            })
          );
        }

        if (url.pathname === '/api/admin/analytics' && method === 'GET') {
          requireAdmin(init?.headers);
          return json(
            adminService.listAnalyticsEvents({
              gameKey: url.searchParams.get('gameKey') ?? undefined,
              gameUserId: url.searchParams.get('gameUserId') ? Number(url.searchParams.get('gameUserId')) : undefined,
              eventName: url.searchParams.get('eventName') ?? undefined
            })
          );
        }

        return json(fail(errorCodes.BAD_REQUEST, `unsupported route: ${method} ${url.pathname}`), 400);
      } catch (error) {
        if (error instanceof AppError) {
          return json(fail(error.code, error.message), 400);
        }

        if (error instanceof Error && error.message.startsWith('Invalid verification id')) {
          return json(fail(errorCodes.AD_VERIFY_FAILED, error.message), 400);
        }

        const message = error instanceof Error ? error.message : 'internal error';
        return json(fail('INTERNAL_ERROR', message), 500);
      }
    }
  };
}
