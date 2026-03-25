import { ok } from '../../common/response';

export class ConfigService {
  getConfig(gameKey: string, platform: string, clientVersion: string) {
    return ok({
      configVersion: 'local-dev',
      gameKey,
      minClientVersion: '0.1.0',
      maxClientVersion: clientVersion,
      payload: {},
      platform,
      updatedAt: Date.now()
    });
  }
}

