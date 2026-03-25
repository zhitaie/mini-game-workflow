export function assertGameKey(gameKey: string): string {
  if (!gameKey) {
    throw new Error('gameKey is required.');
  }

  return gameKey;
}

