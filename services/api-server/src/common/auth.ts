export interface AuthClaims {
  gameUserId: number;
  gameKey: string;
  platform: string;
}

export function createToken(claims: AuthClaims): string {
  return `${claims.gameKey}:${claims.gameUserId}:${claims.platform}`;
}

export function decodeToken(token: string): AuthClaims {
  const [gameKey = 'game_sample', rawGameUserId = '0', platform = 'web'] = token.split(':');

  return {
    gameUserId: Number(rawGameUserId),
    gameKey,
    platform
  };
}
