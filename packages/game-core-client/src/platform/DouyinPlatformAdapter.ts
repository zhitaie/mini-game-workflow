import type { PlatformAdapter, PlatformLoginResult } from './PlatformAdapter';

export class DouyinPlatformAdapter implements PlatformAdapter {
  getPlatform(): string {
    return 'douyin';
  }

  async login(): Promise<PlatformLoginResult> {
    throw new Error('DouyinPlatformAdapter is not implemented yet.');
  }
}

