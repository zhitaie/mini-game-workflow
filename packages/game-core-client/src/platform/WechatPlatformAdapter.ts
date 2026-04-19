import type { NetworkRequestImpl, NetworkTransportResponse } from '@mini-game-workflow/game-core-types';
import type { PlatformAdHandle, PlatformAdapter, PlatformLoginResult } from './PlatformAdapter.js';

interface WechatLoginSuccessResult {
  code: string;
}

interface WechatRewardedVideoAdCloseResult {
  isEnded?: boolean;
}

interface WechatRewardedVideoAd {
  show(): Promise<void>;
  load(): Promise<void>;
  onClose(callback: (result: WechatRewardedVideoAdCloseResult) => void): void;
  offClose(callback: (result: WechatRewardedVideoAdCloseResult) => void): void;
}

interface WechatRequestSuccessResult {
  statusCode: number;
  data: unknown;
}

interface WechatRequestTask {
  abort(): void;
}

interface WechatNamespace {
  login(options: {
    success(result: WechatLoginSuccessResult): void;
    fail?(error: unknown): void;
  }): void;
  request(options: {
    url: string;
    method: string;
    header?: Record<string, string>;
    data?: string;
    timeout?: number;
    success?(result: WechatRequestSuccessResult): void;
    fail?(error: unknown): void;
  }): WechatRequestTask | void;
  createRewardedVideoAd(options: { adUnitId: string }): WechatRewardedVideoAd;
}

interface WechatPlatformAdapterOptions {
  rewardedVideoAdUnitIds?: Record<string, string>;
}

class WechatRewardedVideoAdHandle implements PlatformAdHandle {
  constructor(private readonly ad: WechatRewardedVideoAd) {}

  async show(): Promise<boolean> {
    await this.showWithRetry();

    return new Promise<boolean>((resolve) => {
      const handleClose = (result: WechatRewardedVideoAdCloseResult): void => {
        this.ad.offClose(handleClose);
        resolve(result.isEnded !== false);
      };

      this.ad.onClose(handleClose);
    });
  }

  private async showWithRetry(): Promise<void> {
    try {
      await this.ad.show();
    } catch {
      await this.ad.load();
      await this.ad.show();
    }
  }
}

function getWechatNamespace(): WechatNamespace {
  const namespace = (globalThis as typeof globalThis & { wx?: WechatNamespace }).wx;
  if (!namespace) {
    throw new Error('Current runtime does not expose wx. Please run inside WeChat Mini Game.');
  }

  return namespace;
}

export function isWechatMiniGameRuntime(): boolean {
  const namespace = (globalThis as typeof globalThis & { wx?: Partial<WechatNamespace> }).wx;
  return !!namespace && typeof namespace.login === 'function' && typeof namespace.request === 'function';
}

export function createWechatRequestImpl(): NetworkRequestImpl {
  return async (url, init) => {
    const wx = getWechatNamespace();

    return new Promise<NetworkTransportResponse>((resolve, reject) => {
      let settled = false;
      let timeoutId: ReturnType<typeof setTimeout> | null = null;

      const finalize = (): void => {
        if (timeoutId) {
          clearTimeout(timeoutId);
          timeoutId = null;
        }
      };

      const task = wx.request({
        url,
        method: init.method,
        header: init.headers,
        data: init.body,
        timeout: init.timeoutMs,
        success(result) {
          if (settled) {
            return;
          }

          settled = true;
          finalize();
          resolve({
            status: result.statusCode,
            async json(): Promise<unknown> {
              return result.data;
            }
          });
        },
        fail(error) {
          if (settled) {
            return;
          }

          settled = true;
          finalize();
          reject(error instanceof Error ? error : new Error('wx.request failed.'));
        }
      });

      if (init.timeoutMs && init.timeoutMs > 0) {
        timeoutId = setTimeout(() => {
          if (settled) {
            return;
          }

          settled = true;
          task?.abort?.();
          reject(new Error(`wx.request timed out after ${String(init.timeoutMs)}ms.`));
        }, init.timeoutMs + 80);
      }
    });
  };
}

export class WechatPlatformAdapter implements PlatformAdapter {
  private readonly rewardedAds = new Map<string, WechatRewardedVideoAd>();

  readonly ad = {
    createRewardedVideo: async (sceneKey: string): Promise<PlatformAdHandle> => {
      const adUnitId = this.options.rewardedVideoAdUnitIds?.[sceneKey];
      if (!adUnitId) {
        throw new Error(`Missing WeChat rewarded video adUnitId for sceneKey: ${sceneKey}`);
      }

      const wx = getWechatNamespace();
      const cacheKey = `${sceneKey}:${adUnitId}`;
      let ad = this.rewardedAds.get(cacheKey);
      if (!ad) {
        ad = wx.createRewardedVideoAd({ adUnitId });
        this.rewardedAds.set(cacheKey, ad);
      }

      return new WechatRewardedVideoAdHandle(ad);
    }
  };

  constructor(private readonly options: WechatPlatformAdapterOptions = {}) {}

  getPlatform(): string {
    return 'wechat';
  }

  async login(): Promise<PlatformLoginResult> {
    const wx = getWechatNamespace();

    return new Promise<PlatformLoginResult>((resolve, reject) => {
      wx.login({
        success(result) {
          if (!result.code) {
            reject(new Error('wx.login returned an empty code.'));
            return;
          }

          resolve({
            code: result.code
          });
        },
        fail(error) {
          reject(error instanceof Error ? error : new Error('wx.login failed.'));
        }
      });
    });
  }
}
