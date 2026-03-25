import type { AdResult } from '@mini-game-workflow/game-core-types';

export interface AdManager {
  showRewardedVideo(sceneKey: string): Promise<AdResult>;
}

