import { ok } from '../../common/response.js';
import type { GameConfigRepository } from '../../db/repositories/game-config.repository.js';

function compareVersion(left: string, right: string): number {
  const leftParts = left.split('.').map((part) => Number(part));
  const rightParts = right.split('.').map((part) => Number(part));
  const maxLength = Math.max(leftParts.length, rightParts.length);

  for (let index = 0; index < maxLength; index += 1) {
    const leftValue = Number.isFinite(leftParts[index]) ? leftParts[index] : 0;
    const rightValue = Number.isFinite(rightParts[index]) ? rightParts[index] : 0;

    if (leftValue > rightValue) {
      return 1;
    }

    if (leftValue < rightValue) {
      return -1;
    }
  }

  return 0;
}

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

    if (record.minClientVersion && compareVersion(clientVersion, record.minClientVersion) < 0) {
      throw new Error(`Client version ${clientVersion} is below minimum ${record.minClientVersion}`);
    }

    if (record.maxClientVersion && compareVersion(clientVersion, record.maxClientVersion) > 0) {
      throw new Error(`Client version ${clientVersion} is above maximum ${record.maxClientVersion}`);
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
