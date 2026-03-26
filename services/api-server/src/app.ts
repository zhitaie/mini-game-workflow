import type { AdminPermissionCode } from '@mini-game-workflow/game-core-types';
import { decodeToken, type AuthClaims } from './common/auth.js';
import { hasAdminPermission, type AdminActor } from './common/admin.js';
import { errorCodes } from './common/errors.js';
import { fail } from './common/response.js';
import { initializeDevelopmentDatabase } from './db/bootstrap.js';
import { AdLogRepository } from './db/repositories/ad-log.repository.js';
import { AdminAuditLogRepository } from './db/repositories/admin-audit-log.repository.js';
import { AdminSessionRepository } from './db/repositories/admin-session.repository.js';
import { AdminUserRepository } from './db/repositories/admin-user.repository.js';
import { AnalyticsEventRepository } from './db/repositories/analytics-event.repository.js';
import { GameConfigRepository } from './db/repositories/game-config.repository.js';
import { GameUserRepository } from './db/repositories/game-user.repository.js';
import { NoticeRepository } from './db/repositories/notice.repository.js';
import { RewardLogRepository } from './db/repositories/reward-log.repository.js';
import { UserAssetBalanceRepository } from './db/repositories/user-asset-balance.repository.js';
import { UserSaveRepository } from './db/repositories/user-save.repository.js';
import { AdService } from './modules/ad/ad.service.js';
import { AdminService } from './modules/admin/admin.service.js';
import { AdminAuthService } from './modules/admin-auth/admin-auth.service.js';
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

function statusForErrorCode(code: string): number {
  switch (code) {
    case errorCodes.UNAUTHORIZED:
      return 401;
    case errorCodes.FORBIDDEN:
      return 403;
    case 'NOT_FOUND':
      return 404;
    case 'CONFLICT':
      return 409;
    default:
      return 400;
  }
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

  try {
    return decodeToken(token);
  } catch {
    throw new AppError(errorCodes.UNAUTHORIZED, 'invalid token');
  }
}

function optionalAuth(headers: HeadersInit | undefined): AuthClaims | null {
  const token = readToken(headers);
  if (!token) {
    return null;
  }

  try {
    return decodeToken(token);
  } catch {
    return null;
  }
}

function readAdminToken(headers: HeadersInit | undefined): string | null {
  const normalized = new Headers(headers);
  const headerToken = normalized.get('x-admin-token');
  if (headerToken) {
    return headerToken;
  }

  const authorization = normalized.get('Authorization');
  if (!authorization) {
    return null;
  }

  return authorization.replace(/^Bearer\s+/u, '');
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

function readRequiredString(body: Record<string, unknown>, key: string): string {
  const value = body[key];

  if (typeof value !== 'string' || value.trim() === '') {
    throw new AppError(errorCodes.BAD_REQUEST, `invalid ${key}`);
  }

  return value.trim();
}

function readOptionalString(body: Record<string, unknown>, key: string): string | undefined {
  const value = body[key];

  if (value === undefined || value === null || value === '') {
    return undefined;
  }

  if (typeof value !== 'string') {
    throw new AppError(errorCodes.BAD_REQUEST, `invalid ${key}`);
  }

  return value.trim() || undefined;
}

function readOptionalTimestamp(body: Record<string, unknown>, key: string): number | null {
  const value = body[key];

  if (value === undefined || value === null || value === '') {
    return null;
  }

  if (typeof value === 'number' && Number.isFinite(value)) {
    return value;
  }

  if (typeof value === 'string') {
    const parsed = Date.parse(value);

    if (!Number.isNaN(parsed)) {
      return parsed;
    }
  }

  throw new AppError(errorCodes.BAD_REQUEST, `invalid ${key}`);
}

function readOptionalNumber(body: Record<string, unknown>, key: string): number | undefined {
  const value = body[key];

  if (value === undefined || value === null || value === '') {
    return undefined;
  }

  if (typeof value === 'number' && Number.isFinite(value)) {
    return value;
  }

  if (typeof value === 'string') {
    const parsed = Number(value);

    if (Number.isFinite(parsed)) {
      return parsed;
    }
  }

  throw new AppError(errorCodes.BAD_REQUEST, `invalid ${key}`);
}

function readRequiredNumber(body: Record<string, unknown>, key: string): number {
  const value = readOptionalNumber(body, key);

  if (value === undefined) {
    throw new AppError(errorCodes.BAD_REQUEST, `invalid ${key}`);
  }

  return value;
}

function readRecord(body: Record<string, unknown>, key: string): Record<string, unknown> {
  const value = body[key];

  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new AppError(errorCodes.BAD_REQUEST, `invalid ${key}`);
  }

  return value as Record<string, unknown>;
}

function readConfigStatus(body: Record<string, unknown>, key: string): 'draft' | 'active' | 'archived' {
  const value = body[key];

  if (value === 'draft' || value === 'active' || value === 'archived') {
    return value;
  }

  throw new AppError(errorCodes.BAD_REQUEST, `invalid ${key}`);
}

export interface ApiApp {
  name: string;
  databaseFilePath: string;
  fetch(input: RequestInfo | URL, init?: RequestInit): Promise<Response>;
  close(): void;
}

export interface CreateAppOptions {
  database?: {
    filePath?: string;
  };
}

export function createApp(options: CreateAppOptions = {}): ApiApp {
  const database = initializeDevelopmentDatabase({
    filePath: options.database?.filePath
  });
  const adminAuditLogRepository = new AdminAuditLogRepository(database);
  const adminSessionRepository = new AdminSessionRepository(database);
  const adminUserRepository = new AdminUserRepository(database);
  const analyticsEventRepository = new AnalyticsEventRepository(database);
  const adLogRepository = new AdLogRepository(database);
  const gameUserRepository = new GameUserRepository(database);
  const gameConfigRepository = new GameConfigRepository(database);
  const noticeRepository = new NoticeRepository(database);
  const rewardLogRepository = new RewardLogRepository(database);
  const userAssetBalanceRepository = new UserAssetBalanceRepository(database);
  const userSaveRepository = new UserSaveRepository(database);

  const adService = new AdService(adLogRepository);
  const adminAuthService = new AdminAuthService(adminUserRepository, adminSessionRepository);
  const adminService = new AdminService(
    gameUserRepository,
    gameConfigRepository,
    noticeRepository,
    adLogRepository,
    rewardLogRepository,
    analyticsEventRepository,
    adminAuditLogRepository
  );
  const analyticsService = new AnalyticsService(analyticsEventRepository);
  const authService = new AuthService(gameUserRepository);
  const configService = new ConfigService(gameConfigRepository);
  const noticeService = new NoticeService(noticeRepository);
  const rewardService = new RewardService(database, rewardLogRepository, userAssetBalanceRepository, adLogRepository);
  const saveService = new SaveService(userSaveRepository);

  const validateClaims = (claims: AuthClaims): AuthClaims => {
    const user = gameUserRepository.findById(claims.gameUserId);

    if (!user || user.gameKey !== claims.gameKey || user.platform !== claims.platform || user.status !== 'active') {
      throw new AppError(errorCodes.UNAUTHORIZED, 'invalid token');
    }

    return claims;
  };

  const requireAuthorizedClaims = (headers: HeadersInit | undefined): AuthClaims => {
    return validateClaims(requireAuth(headers));
  };

  const resolveOptionalClaims = (headers: HeadersInit | undefined): AuthClaims | null => {
    const claims = optionalAuth(headers);
    return claims ? validateClaims(claims) : null;
  };

  const requireAdminActor = (headers: HeadersInit | undefined, permission: AdminPermissionCode): AdminActor => {
    const token = readAdminToken(headers);

    if (!token) {
      throw new AppError(errorCodes.UNAUTHORIZED, 'missing admin token');
    }

    const session = adminAuthService.getSession(token);

    if (!session) {
      throw new AppError(errorCodes.UNAUTHORIZED, 'invalid admin session');
    }

    if (!hasAdminPermission(session.permissions, permission)) {
      throw new AppError(errorCodes.FORBIDDEN, `missing permission: ${permission}`);
    }

    return {
      sessionId: session.id,
      adminUserId: session.adminUserId,
      username: session.username,
      displayName: session.displayName,
      roleCode: session.roleCode,
      roleName: session.roleName,
      permissions: session.permissions,
      expiresAt: session.expiresAt
    };
  };

  return {
    name: 'api-server',
    databaseFilePath: database.filePath,
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

        if (url.pathname === '/api/admin/auth/login' && method === 'POST') {
          const body = parseBody(init);
          const response = adminAuthService.login({
            username: readRequiredString(body, 'username'),
            password: readRequiredString(body, 'password')
          });

          if (!response) {
            throw new AppError(errorCodes.UNAUTHORIZED, 'invalid admin credentials');
          }

          return json(response);
        }

        if (url.pathname === '/api/admin/auth/me' && method === 'GET') {
          const token = readAdminToken(init?.headers);

          if (!token) {
            throw new AppError(errorCodes.UNAUTHORIZED, 'missing admin token');
          }

          const response = adminAuthService.getMe(token);

          if (!response) {
            throw new AppError(errorCodes.UNAUTHORIZED, 'invalid admin session');
          }

          return json(response);
        }

        if (url.pathname === '/api/admin/auth/logout' && method === 'POST') {
          const token = readAdminToken(init?.headers);

          if (!token) {
            throw new AppError(errorCodes.UNAUTHORIZED, 'missing admin token');
          }

          return json(adminAuthService.logout(token));
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
          return json(saveService.getSave(requireAuthorizedClaims(init?.headers)));
        }

        if (url.pathname === '/api/save' && method === 'POST') {
          const claims = requireAuthorizedClaims(init?.headers);
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
              resolveOptionalClaims(init?.headers)
            )
          );
        }

        if (url.pathname === '/api/ad/verify' && method === 'POST') {
          const claims = requireAuthorizedClaims(init?.headers);
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
          const claims = requireAuthorizedClaims(init?.headers);
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
          requireAdminActor(init?.headers, 'dashboard.read');
          return json(adminService.getDashboardSummary(String(url.searchParams.get('gameKey') ?? '')));
        }

        if (url.pathname === '/api/admin/users' && method === 'GET') {
          requireAdminActor(init?.headers, 'users.read');
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
          requireAdminActor(init?.headers, 'configs.read');
          return json(
            adminService.listConfigs({
              gameKey: url.searchParams.get('gameKey') ?? undefined,
              platform: url.searchParams.get('platform') ?? undefined,
              status: (url.searchParams.get('status') as 'draft' | 'active' | 'archived' | null) ?? undefined
            })
          );
        }

        if (url.pathname === '/api/admin/configs/draft' && method === 'POST') {
          const actor = requireAdminActor(init?.headers, 'configs.write');
          const body = parseBody(init);
          const response = adminService.saveConfigDraft({
            actor,
            gameKey: readRequiredString(body, 'gameKey'),
            platform: readRequiredString(body, 'platform'),
            configVersion: readRequiredString(body, 'configVersion'),
            minClientVersion: readOptionalString(body, 'minClientVersion'),
            maxClientVersion: readOptionalString(body, 'maxClientVersion'),
            payload: readRecord(body, 'payload')
          });

          if (!response) {
            throw new AppError(errorCodes.BAD_REQUEST, 'config version is already active and cannot be rewritten as draft');
          }

          return json(response);
        }

        if (url.pathname === '/api/admin/configs/publish' && method === 'POST') {
          const actor = requireAdminActor(init?.headers, 'configs.publish');
          const body = parseBody(init);
          const response = adminService.publishConfig({
            actor,
            gameKey: readRequiredString(body, 'gameKey'),
            platform: readRequiredString(body, 'platform'),
            configVersion: readRequiredString(body, 'configVersion')
          });

          if (!response) {
            throw new AppError(errorCodes.BAD_REQUEST, 'config version not found');
          }

          return json(response);
        }

        if (url.pathname === '/api/admin/configs/archive' && method === 'POST') {
          const actor = requireAdminActor(init?.headers, 'configs.publish');
          const body = parseBody(init);
          const response = adminService.archiveConfig({
            actor,
            gameKey: readRequiredString(body, 'gameKey'),
            platform: readRequiredString(body, 'platform'),
            configVersion: readRequiredString(body, 'configVersion')
          });

          if (!response) {
            throw new AppError(errorCodes.BAD_REQUEST, 'config version not found');
          }

          return json(response);
        }

        if (url.pathname === '/api/admin/notices' && method === 'GET') {
          requireAdminActor(init?.headers, 'notices.read');
          return json(
            adminService.listNotices({
              gameKey: url.searchParams.get('gameKey') ?? undefined,
              status: (url.searchParams.get('status') as 'draft' | 'active' | 'archived' | null) ?? undefined
            })
          );
        }

        if (url.pathname === '/api/admin/notices/save' && method === 'POST') {
          const actor = requireAdminActor(init?.headers, 'notices.write');
          const body = parseBody(init);
          const response = adminService.saveNotice({
            actor,
            id: readOptionalNumber(body, 'id'),
            gameKey: readRequiredString(body, 'gameKey'),
            title: readRequiredString(body, 'title'),
            content: readRequiredString(body, 'content'),
            status: readConfigStatus(body, 'status'),
            startTime: readOptionalTimestamp(body, 'startTime'),
            endTime: readOptionalTimestamp(body, 'endTime')
          });

          if (!response) {
            throw new AppError(errorCodes.BAD_REQUEST, 'notice not found');
          }

          return json(response);
        }

        if (url.pathname === '/api/admin/notices/status' && method === 'POST') {
          const actor = requireAdminActor(init?.headers, 'notices.write');
          const body = parseBody(init);
          const response = adminService.setNoticeStatus({
            actor,
            gameKey: readRequiredString(body, 'gameKey'),
            id: readRequiredNumber(body, 'id'),
            status: readConfigStatus(body, 'status')
          });

          if (!response) {
            throw new AppError(errorCodes.BAD_REQUEST, 'notice not found');
          }

          return json(response);
        }

        if (url.pathname === '/api/admin/ad-logs' && method === 'GET') {
          requireAdminActor(init?.headers, 'logs.read');
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
          requireAdminActor(init?.headers, 'logs.read');
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
          requireAdminActor(init?.headers, 'logs.read');
          return json(
            adminService.listAnalyticsEvents({
              gameKey: url.searchParams.get('gameKey') ?? undefined,
              gameUserId: url.searchParams.get('gameUserId') ? Number(url.searchParams.get('gameUserId')) : undefined,
              eventName: url.searchParams.get('eventName') ?? undefined
            })
          );
        }

        if (url.pathname === '/api/admin/audit-logs' && method === 'GET') {
          requireAdminActor(init?.headers, 'audit.read');
          return json(
            adminService.listAuditLogs({
              gameKey: url.searchParams.get('gameKey') ?? undefined,
              adminUserId: url.searchParams.get('adminUserId') ? Number(url.searchParams.get('adminUserId')) : undefined,
              action: url.searchParams.get('action') ?? undefined,
              targetType: url.searchParams.get('targetType') ?? undefined
            })
          );
        }

        return json(fail(errorCodes.BAD_REQUEST, `unsupported route: ${method} ${url.pathname}`), 400);
      } catch (error) {
        if (error instanceof AppError) {
          return json(fail(error.code, error.message), statusForErrorCode(error.code));
        }

        if (error instanceof Error && error.message.startsWith('Invalid verification id')) {
          return json(fail(errorCodes.AD_VERIFY_FAILED, error.message), 400);
        }

        if (error instanceof Error && error.message.startsWith('Token game mismatch')) {
          return json(fail(errorCodes.TOKEN_GAME_MISMATCH, error.message), 400);
        }

        if (
          error instanceof Error &&
          (
            error.message.startsWith('No compatible active config') ||
            error.message.startsWith('Config version window overlaps active config')
          )
        ) {
          return json(fail(errorCodes.BAD_REQUEST, error.message), 400);
        }

        const message = error instanceof Error ? error.message : 'internal error';
        return json(fail('INTERNAL_ERROR', message), 500);
      }
    },
    close(): void {
      database.close();
    }
  };
}
