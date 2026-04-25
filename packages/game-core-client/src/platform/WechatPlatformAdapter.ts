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

interface WechatRequestOptions {
  url: string;
  method: string;
  header?: Record<string, string>;
  data?: string;
  timeout?: number;
  success?(result: WechatRequestSuccessResult): void;
  fail?(error: unknown): void;
}

interface WechatNamespace {
  login(options: {
    success(result: WechatLoginSuccessResult): void;
    fail?(error: unknown): void;
  }): void;
  request(options: WechatRequestOptions): WechatRequestTask | void;
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

function toWechatErrorMessage(prefix: string, error: unknown): string {
  if (error instanceof Error) {
    return `${prefix}: ${error.message}`;
  }

  if (error && typeof error === 'object' && 'errMsg' in error) {
    return `${prefix}: ${String((error as { errMsg?: unknown }).errMsg)}`;
  }

  try {
    return `${prefix}: ${JSON.stringify(error)}`;
  } catch {
    return prefix;
  }
}

function buildWechatRequestOptions(
  url: string,
  init: Parameters<NetworkRequestImpl>[1],
  callbacks: {
    success(result: WechatRequestSuccessResult): void;
    fail(error: unknown): void;
  }
): WechatRequestOptions {
  const requestOptions: WechatRequestOptions = {
    url,
    method: init.method,
    success: callbacks.success,
    fail: callbacks.fail
  };

  if (Object.keys(init.headers).length > 0) {
    requestOptions.header = init.headers;
  }

  if (init.body !== undefined) {
    requestOptions.data = init.body;
  }

  if (typeof init.timeoutMs === 'number' && Number.isFinite(init.timeoutMs) && init.timeoutMs > 0) {
    requestOptions.timeout = init.timeoutMs;
  }

  return requestOptions;
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

      const task = wx.request(buildWechatRequestOptions(url, init, {
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
          reject(new Error(toWechatErrorMessage('wx.request failed', error)));
        }
      }));

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
