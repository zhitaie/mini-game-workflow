import { createToken } from '../../common/auth.js';
import { ok } from '../../common/response.js';
import type { GameUserRepository } from '../../db/repositories/game-user.repository.js';

export interface LoginInput {
  gameKey: string;
  platform: string;
  code: string;
  clientVersion: string;
}

export class AuthService {
  private readonly gameUserRepository: GameUserRepository;

  constructor(gameUserRepository: GameUserRepository) {
    this.gameUserRepository = gameUserRepository;
  }

  login(input: LoginInput) {
    const { record, isNewUser } = this.gameUserRepository.findOrCreate({
      gameKey: input.gameKey,
      platform: input.platform,
      platformOpenId: `${input.platform}:${input.code}`
    });

    return ok({
      token: createToken({
        gameKey: record.gameKey,
        gameUserId: record.id,
        platform: record.platform
      }),
      user: {
        id: record.id,
        gameKey: record.gameKey,
        platform: record.platform,
        nickname: record.nickname,
        avatar: record.avatar,
        status: record.status
      },
      isNewUser
    });
  }
}
