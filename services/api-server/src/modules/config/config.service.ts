import { ok } from '../../common/response.js';
import type { GameConfigRepository } from '../../db/repositories/game-config.repository.js';

export class ConfigService {
  private readonly gameConfigRepository: GameConfigRepository;

  constructor(gameConfigRepository: GameConfigRepository) {
    this.gameConfigRepository = gameConfigRepository;
  }

  getConfig(gameKey: string, platform: string, clientVersion: string) {
    const record = this.gameConfigRepository.findActive(gameKey, platform);

    if (!record) {
      throw new Error(`No active config for ${gameKey}:${platform}`);
    }

    return ok({
      configVersion: record.configVersion,
      gameKey,
      minClientVersion: record.minClientVersion ?? '0.1.0',
      maxClientVersion: record.maxClientVersion ?? clientVersion,
      payload: record.payload,
      updatedAt: record.updatedAt
    });
  }
}
