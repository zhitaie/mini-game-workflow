export interface SkiEndlessPlatformConfig {
  web: {
    apiBaseURL: string;
  };
  wechat: {
    // AppID is build-time metadata in Cocos/WeChat DevTools.
    // Keep only runtime fields here.
    apiBaseURL: string;
    rewardedVideoAdUnitIds: Record<string, string>;
  };
}

export const skiEndlessPlatformConfig: SkiEndlessPlatformConfig = {
  web: {
    apiBaseURL: 'http://127.0.0.1:3000'
  },
  wechat: {
    apiBaseURL: 'https://api-mini.zhitaie.com',
    rewardedVideoAdUnitIds: {
      ski_revive: 'replace-with-wechat-revive-ad-unit-id',
      ski_double_coin: 'replace-with-wechat-double-coin-ad-unit-id'
    }
  }
};
