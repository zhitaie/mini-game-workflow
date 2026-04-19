export type SkiModeKey = 'endless' | 'time_attack' | 'challenge';
export type SkiMapKey = 'snowfield' | 'forest' | 'night';

export interface SkiEndlessConfig {
  gameplay: {
    baseSpeed: number;
    maxSpeed: number;
    obstacleDensity: number;
    scorePerMeter: number;
  };
  rewardAd: {
    reviveEnabled: boolean;
    doubleCoinEnabled: boolean;
  };
  rotation: {
    defaultMode: SkiModeKey;
    defaultMap: SkiMapKey;
    availableModes: SkiModeKey[];
    availableMaps: SkiMapKey[];
  };
}

export const localSkiEndlessConfig: SkiEndlessConfig = {
  gameplay: {
    baseSpeed: 6.6,
    maxSpeed: 12.4,
    obstacleDensity: 0.92,
    scorePerMeter: 1
  },
  rewardAd: {
    reviveEnabled: true,
    doubleCoinEnabled: true
  },
  rotation: {
    defaultMode: 'endless',
    defaultMap: 'snowfield',
    availableModes: ['endless'],
    availableMaps: ['snowfield']
  }
};
