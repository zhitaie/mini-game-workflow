import type { AdManager } from './AdManager.js';
import type { PlatformAdapter } from '../platform/PlatformAdapter.js';

export function createAdManager(platform: PlatformAdapter): AdManager {
  return {
    async showRewardedVideo(sceneKey: string) {
      if (!platform.ad) {
        throw new Error('Current platform does not support ad capability.');
      }

      const handle = await platform.ad.createRewardedVideo(sceneKey);
      const completed = await handle.show();

      return {
        completed,
        sceneKey,
        adType: 'rewardedVideo'
      };
    }
  };
}
