export interface SkiEndlessPlatformConfig {
  web: {
    apiBaseURL: string;
  };
  wechat: {
    apiBaseURL: string;
    rewardedVideoAdUnitIds: Record<string, string>;
  };
}

export const skiEndlessPlatformConfig: SkiEndlessPlatformConfig = {
  web: {
    apiBaseURL: 'http://127.0.0.1:3000'
  },
  wechat: {
    apiBaseURL: 'https://replace-with-your-mini-game-api.example.com',
    rewardedVideoAdUnitIds: {
      ski_revive: 'replace-with-wechat-revive-ad-unit-id',
      ski_double_coin: 'replace-with-wechat-double-coin-ad-unit-id'
    }
  }
};
