import { ok } from '../../common/response.js';
import type { AuthClaims } from '../../common/auth.js';
import type { GameUserRepository } from '../../db/repositories/game-user.repository.js';
import type { UserSaveRepository } from '../../db/repositories/user-save.repository.js';

interface RankRow {
  gameUserId: number;
  nickname: string;
  bestDistance: number;
  bestScore: number;
  updatedAt: number;
}

function readNumericField(value: unknown): number {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return value;
  }

  if (typeof value === 'string') {
    const parsed = Number(value);
    if (Number.isFinite(parsed)) {
      return parsed;
    }
  }

  return 0;
}

export class RankService {
  private readonly gameUserRepository: GameUserRepository;
  private readonly userSaveRepository: UserSaveRepository;

  constructor(gameUserRepository: GameUserRepository, userSaveRepository: UserSaveRepository) {
    this.gameUserRepository = gameUserRepository;
    this.userSaveRepository = userSaveRepository;
  }

  getDistanceLeaderboard(gameKey: string, limit = 10, claims: AuthClaims | null = null) {
    const normalizedLimit = Number.isFinite(limit) ? Math.max(1, Math.min(20, Math.floor(limit))) : 10;
    const ranking = this.userSaveRepository
      .listByGameKey(gameKey)
      .map((record) => {
        const user = this.gameUserRepository.findById(record.gameUserId);

        if (!user || user.status !== 'active') {
          return null;
        }

        return {
          gameUserId: record.gameUserId,
          nickname: user.nickname.trim() || `Rider ${String(user.id)}`,
          bestDistance: Math.floor(readNumericField(record.data.bestDistance)),
          bestScore: Math.floor(readNumericField(record.data.bestScore)),
          updatedAt: record.updatedAt
        } satisfies RankRow;
      })
      .filter((row): row is RankRow => row !== null && row.bestDistance > 0)
      .sort((left, right) => {
        if (right.bestDistance !== left.bestDistance) {
          return right.bestDistance - left.bestDistance;
        }

        if (right.bestScore !== left.bestScore) {
          return right.bestScore - left.bestScore;
        }

        return left.updatedAt - right.updatedAt;
      });

    const items = ranking.slice(0, normalizedLimit).map((row, index) => ({
      rank: index + 1,
      gameUserId: row.gameUserId,
      nickname: row.nickname,
      bestDistance: row.bestDistance,
      bestScore: row.bestScore
    }));

    const currentUser =
      claims && claims.gameKey === gameKey
        ? (() => {
            const index = ranking.findIndex((row) => row.gameUserId === claims.gameUserId);

            if (index < 0) {
              return null;
            }

            const row = ranking[index];
            return {
              rank: index + 1,
              gameUserId: row.gameUserId,
              nickname: row.nickname,
              bestDistance: row.bestDistance,
              bestScore: row.bestScore
            };
          })()
        : null;

    return ok({
      gameKey,
      metric: 'best_distance',
      items,
      currentUser
    });
  }
}
