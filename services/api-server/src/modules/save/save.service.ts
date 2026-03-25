import { ok } from '../../common/response.js';
import type { AuthClaims } from '../../common/auth.js';
import type { UserSaveRepository } from '../../db/repositories/user-save.repository.js';

export interface SaveInput {
  save: {
    schemaVersion: number;
    data: Record<string, unknown>;
  };
}

export class SaveService {
  private readonly userSaveRepository: UserSaveRepository;

  constructor(userSaveRepository: UserSaveRepository) {
    this.userSaveRepository = userSaveRepository;
  }

  getSave(claims: AuthClaims) {
    const save = this.userSaveRepository.get(claims.gameKey, claims.gameUserId);

    return ok({
      save: save
        ? {
            schemaVersion: save.schemaVersion,
            data: save.data,
            updatedAt: save.updatedAt
          }
        : null
    });
  }

  replaceSave(claims: AuthClaims, input: SaveInput) {
    const stored = this.userSaveRepository.put({
      gameKey: claims.gameKey,
      gameUserId: claims.gameUserId,
      schemaVersion: input.save.schemaVersion,
      data: input.save.data
    });

    return ok({
      save: {
        schemaVersion: stored.schemaVersion,
        data: stored.data,
        updatedAt: stored.updatedAt
      }
    });
  }
}
