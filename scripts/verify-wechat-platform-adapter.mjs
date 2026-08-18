import assert from 'node:assert/strict';
import {
  WechatPlatformAdapter,
  createWechatRequestImpl,
  isWechatMiniGameRuntime
} from '../packages/game-core-client/dist/game-core-client/src/platform/WechatPlatformAdapter.js';

const hadWechatNamespace = Object.prototype.hasOwnProperty.call(globalThis, 'wx');
const originalWechatNamespace = globalThis.wx;

function installWechatNamespace(overrides = {}) {
  globalThis.wx = {
    login({ success }) {
      success({ code: 'verify-login-code' });
    },
    request() {
      throw new Error('Unexpected wx.request call.');
    },
    createRewardedVideoAd() {
      throw new Error('Unexpected wx.createRewardedVideoAd call.');
    },
    ...overrides
  };
}

try {
  delete globalThis.wx;
  assert.equal(isWechatMiniGameRuntime(), false);

  installWechatNamespace();
  assert.equal(isWechatMiniGameRuntime(), true);

  const loginAdapter = new WechatPlatformAdapter();
  assert.deepEqual(await loginAdapter.login(), { code: 'verify-login-code' });

  installWechatNamespace({
    login({ success }) {
      success({ code: '' });
    }
  });
  await assert.rejects(() => new WechatPlatformAdapter().login(), /empty code/);

  installWechatNamespace({
    login({ fail }) {
      fail?.({ errMsg: 'login failed' });
    }
  });
  await assert.rejects(() => new WechatPlatformAdapter().login(), /wx.login failed/);

  let successfulRequestOptions;
  installWechatNamespace({
    request(options) {
      successfulRequestOptions = options;
      queueMicrotask(() => options.success?.({ statusCode: 201, data: { accepted: true } }));
      return { abort() {} };
    }
  });
  const request = createWechatRequestImpl();
  const response = await request('https://example.test/api', {
    method: 'POST',
    headers: { Authorization: 'Bearer verify-token' },
    body: '{"value":1}',
    timeoutMs: 300
  });
  assert.equal(response.status, 201);
  assert.deepEqual(await response.json(), { accepted: true });
  assert.equal(successfulRequestOptions.url, 'https://example.test/api');
  assert.equal(successfulRequestOptions.method, 'POST');
  assert.deepEqual(successfulRequestOptions.header, { Authorization: 'Bearer verify-token' });
  assert.equal(successfulRequestOptions.data, '{"value":1}');
  assert.equal(successfulRequestOptions.timeout, 300);

  installWechatNamespace({
    request(options) {
      queueMicrotask(() => options.fail?.({ errMsg: 'request:fail offline' }));
      return { abort() {} };
    }
  });
  await assert.rejects(
    () => createWechatRequestImpl()('https://example.test/api', { method: 'GET', headers: {} }),
    /wx.request failed: request:fail offline/
  );

  let abortCount = 0;
  installWechatNamespace({
    request() {
      return {
        abort() {
          abortCount += 1;
        }
      };
    }
  });
  await assert.rejects(
    () => createWechatRequestImpl()('https://example.test/api', { method: 'GET', headers: {}, timeoutMs: 1 }),
    /timed out/
  );
  assert.equal(abortCount, 1);

  const strictAdAdapter = new WechatPlatformAdapter();
  await assert.rejects(() => strictAdAdapter.ad.createRewardedVideo('ski_revive'), /Missing WeChat rewarded video adUnitId/);

  const mockAdAdapter = new WechatPlatformAdapter({
    allowMockRewardedVideoOnInvalidAdUnitId: true
  });
  assert.equal(await (await mockAdAdapter.ad.createRewardedVideo('ski_revive')).show(), true);

  let createdAdCount = 0;
  let showAttempts = 0;
  let loadAttempts = 0;
  let closeCallback;
  const retryingAd = {
    async show() {
      showAttempts += 1;
      if (showAttempts === 1) {
        throw new Error('not loaded');
      }
    },
    async load() {
      loadAttempts += 1;
    },
    onClose(callback) {
      closeCallback = callback;
      queueMicrotask(() => callback({ isEnded: false }));
    },
    offClose(callback) {
      assert.equal(callback, closeCallback);
      closeCallback = undefined;
    }
  };
  installWechatNamespace({
    createRewardedVideoAd({ adUnitId }) {
      assert.equal(adUnitId, 'adunit-verify');
      createdAdCount += 1;
      return retryingAd;
    }
  });
  const rewardedAdapter = new WechatPlatformAdapter({
    rewardedVideoAdUnitIds: { ski_revive: 'adunit-verify' }
  });
  const firstAdHandle = await rewardedAdapter.ad.createRewardedVideo('ski_revive');
  await rewardedAdapter.ad.createRewardedVideo('ski_revive');
  assert.equal(await firstAdHandle.show(), false);
  assert.equal(createdAdCount, 1);
  assert.equal(showAttempts, 2);
  assert.equal(loadAttempts, 1);
  assert.equal(closeCallback, undefined);

  const failingAd = {
    async show() {
      throw new Error('show failed');
    },
    async load() {
      throw new Error('load failed');
    },
    onClose() {},
    offClose() {}
  };
  installWechatNamespace({
    createRewardedVideoAd() {
      return failingAd;
    }
  });
  const failingAdAdapter = new WechatPlatformAdapter({
    rewardedVideoAdUnitIds: { ski_revive: 'adunit-fail' }
  });
  const failingAdHandle = await failingAdAdapter.ad.createRewardedVideo('ski_revive');
  await assert.rejects(() => failingAdHandle.show(), /WeChat rewarded video failed: load failed/);

  console.log(
    JSON.stringify(
      {
        login: 'success, empty-code, and failure paths verified',
        request: 'success, failure, and timeout paths verified',
        rewardedAd: 'strict, mock, retry, cancellation, and failure paths verified'
      },
      null,
      2
    )
  );
} finally {
  if (hadWechatNamespace) {
    globalThis.wx = originalWechatNamespace;
  } else {
    delete globalThis.wx;
  }
}
