import { ok } from '../../common/response.js';
import type { AuthClaims } from '../../common/auth.js';
import type { AdLogRepository } from '../../db/repositories/ad-log.repository.js';

export interface VerifyAdInput {
  sceneKey: string;
  adType: string;
  clientTraceId?: string;
  platformResult?: {
    completed?: boolean;
  };
}

export class AdService {
  private readonly adLogRepository: AdLogRepository;

  constructor(adLogRepository: AdLogRepository) {
    this.adLogRepository = adLogRepository;
  }

  verify(claims: AuthClaims, input: VerifyAdInput) {
    const log = this.adLogRepository.create({
      gameKey: claims.gameKey,
      gameUserId: claims.gameUserId,
      sceneKey: input.sceneKey,
      adType: input.adType,
      clientTraceId: input.clientTraceId ?? null,
      errorCode: null,
      verified: true,
      completed: input.platformResult?.completed ?? true
    });

    return ok({
      verified: log.verified,
      verificationId: log.verificationId,
      sceneKey: log.sceneKey,
      completed: log.completed
    });
  }
}
