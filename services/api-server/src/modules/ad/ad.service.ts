import { ok } from '../../common/response';

export class AdService {
  verify(sceneKey: string) {
    return ok({
      verified: true,
      verificationId: `verify:${sceneKey}`,
      sceneKey,
      completed: true
    });
  }
}

