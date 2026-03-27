import type { GameConfig } from '@mini-game-workflow/game-core-types';

export const gameConfig: GameConfig = {
  gameKey: 'ski_endless',
  displayName: 'Ski Endless',
  targets: ['web', 'wechat'],
  features: {
    save: true,
    config: true,
    analytics: true,
    ads: true
  },
  namespaces: {
    save: 'ski_endless.save',
    config: 'ski_endless.config'
  }
};

export default gameConfig;
