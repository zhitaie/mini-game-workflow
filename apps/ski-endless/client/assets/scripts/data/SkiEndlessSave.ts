import type { SaveDefinition, SaveEnvelope } from '@mini-game-workflow/game-core-types';
import type { SkiMapKey, SkiModeKey } from '../config/SkiEndlessConfig.js';

export interface SkiEndlessSaveData {
  coins: number;
  bestDistance: number;
  bestScore: number;
  selectedBoardId: string;
  unlockedBoardIds: string[];
  selectedMode: SkiModeKey;
  selectedMap: SkiMapKey;
  unlockedMaps: SkiMapKey[];
}

export const skiEndlessSaveDefinition: SaveDefinition<SkiEndlessSaveData> = {
  schemaVersion: 1,
  createDefaultData(): SkiEndlessSaveData {
    return {
      coins: 0,
      bestDistance: 0,
      bestScore: 0,
      selectedBoardId: 'starter_board',
      unlockedBoardIds: ['starter_board'],
      selectedMode: 'endless',
      selectedMap: 'snowfield',
      unlockedMaps: ['snowfield']
    };
  },
  migrate(stored: SaveEnvelope<SkiEndlessSaveData>): SaveEnvelope<SkiEndlessSaveData> {
    return stored;
  }
};
