export interface AuthClaims {
  gameUserId: number;
  gameKey: string;
  platform: string;
}

export function decodeToken(token: string): AuthClaims {
  const [gameKey = 'game_sample'] = token.split(':');

  return {
    gameUserId: 1,
    gameKey,
    platform: 'web'
  };
}

