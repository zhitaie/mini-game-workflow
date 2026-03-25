import type { PlatformAdHandle, PlatformAdapter, PlatformLoginResult } from './PlatformAdapter';

class MockRewardedAd implements PlatformAdHandle {
  async show(): Promise<boolean> {
    return true;
  }
}

export class WebMockPlatformAdapter implements PlatformAdapter {
  readonly ad = {
    createRewardedVideo: async (_sceneKey: string): Promise<PlatformAdHandle> => {
      return new MockRewardedAd();
    }
  };

  getPlatform(): string {
    return 'web';
  }

  async login(): Promise<PlatformLoginResult> {
    return {
      code: 'web-mock-login-code'
    };
  }
}

