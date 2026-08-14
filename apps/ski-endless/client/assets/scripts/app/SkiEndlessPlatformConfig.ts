import { skiEndlessPlatformConfigLocal } from './SkiEndlessPlatformConfig.local';

export interface SkiEndlessPlatformConfig {
  web: {
    apiBaseURL: string;
  };
  wechat: {
    // AppID is build-time metadata in Cocos/WeChat DevTools.
    // Keep only runtime fields here.
    apiBaseURL: string;
    rewardedVideoAdUnitIds: Record<string, string>;
    // Enable only for a deliberate local platform integration check.
    allowMockRewardedVideoOnInvalidAdUnitId?: boolean;
  };
}

export const skiEndlessPlatformConfig: SkiEndlessPlatformConfig = skiEndlessPlatformConfigLocal;
