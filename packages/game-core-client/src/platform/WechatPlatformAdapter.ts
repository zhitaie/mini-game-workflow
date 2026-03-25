import type { PlatformAdapter, PlatformLoginResult } from './PlatformAdapter';

export class WechatPlatformAdapter implements PlatformAdapter {
  getPlatform(): string {
    return 'wechat';
  }

  async login(): Promise<PlatformLoginResult> {
    throw new Error('WechatPlatformAdapter is not implemented yet.');
  }
}

