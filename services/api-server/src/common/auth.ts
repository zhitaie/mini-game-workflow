import { createHmac, timingSafeEqual } from 'node:crypto';

export interface AuthClaims {
  gameUserId: number;
  gameKey: string;
  platform: string;
}

function readTokenSecret(): string {
  const value = process.env.MINI_GAME_WORKFLOW_TOKEN_SECRET?.trim();
  if (value) {
    return value;
  }

  if (process.env.NODE_ENV === 'production') {
    throw new Error('MINI_GAME_WORKFLOW_TOKEN_SECRET is required in production');
  }

  return 'mini-game-workflow-dev-secret';
}

const TOKEN_SECRET = readTokenSecret();

function signPayload(payload: string): string {
  return createHmac('sha256', TOKEN_SECRET).update(payload).digest('base64url');
}

export function createToken(claims: AuthClaims): string {
  const payload = Buffer.from(JSON.stringify(claims)).toString('base64url');
  const signature = signPayload(payload);
  return `${payload}.${signature}`;
}

export function decodeToken(token: string): AuthClaims {
  const [payload = '', signature = ''] = token.split('.');

  if (!payload || !signature) {
    throw new Error('invalid token format');
  }

  const expected = signPayload(payload);
  const signatureBuffer = Buffer.from(signature);
  const expectedBuffer = Buffer.from(expected);

  if (signatureBuffer.length !== expectedBuffer.length || !timingSafeEqual(signatureBuffer, expectedBuffer)) {
    throw new Error('invalid token signature');
  }

  const claims = JSON.parse(Buffer.from(payload, 'base64url').toString('utf8')) as Partial<AuthClaims>;

  if (
    typeof claims.gameKey !== 'string' ||
    claims.gameKey.trim() === '' ||
    typeof claims.platform !== 'string' ||
    claims.platform.trim() === '' ||
    typeof claims.gameUserId !== 'number' ||
    !Number.isFinite(claims.gameUserId)
  ) {
    throw new Error('invalid token payload');
  }

  return {
    gameUserId: claims.gameUserId,
    gameKey: claims.gameKey,
    platform: claims.platform
  };
}
