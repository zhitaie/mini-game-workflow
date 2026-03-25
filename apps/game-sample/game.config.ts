import type { GameConfig } from '@mini-game-workflow/game-core-types';

export const gameConfig: GameConfig = {
  gameKey: 'game_sample',
  displayName: 'Game Sample',
  targets: ['web', 'wechat'],
  features: {
    save: true,
    config: true,
    analytics: true,
    ads: true
  },
  namespaces: {
    save: 'game_sample.save',
    config: 'game_sample.config'
  }
};

export default gameConfig;

