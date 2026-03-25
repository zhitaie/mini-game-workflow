import { decodeToken, type AuthClaims } from './common/auth.js';
import { errorCodes } from './common/errors.js';
import { fail } from './common/response.js';
import { GameConfigRepository } from './db/repositories/game-config.repository.js';
import { GameUserRepository } from './db/repositories/game-user.repository.js';
import { UserSaveRepository } from './db/repositories/user-save.repository.js';
import { AuthService } from './modules/auth/auth.service.js';
import { ConfigService } from './modules/config/config.service.js';
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
  const gameUserRepository = new GameUserRepository();
  const gameConfigRepository = new GameConfigRepository();
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

  const authService = new AuthService(gameUserRepository);
  const configService = new ConfigService(gameConfigRepository);
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

        return json(fail(errorCodes.BAD_REQUEST, `unsupported route: ${method} ${url.pathname}`), 400);
      } catch (error) {
        if (error instanceof AppError) {
          return json(fail(error.code, error.message), 400);
        }

        const message = error instanceof Error ? error.message : 'internal error';
        return json(fail('INTERNAL_ERROR', message), 500);
      }
    }
  };
}
