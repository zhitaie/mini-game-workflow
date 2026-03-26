import { bootstrapGameSample } from '../apps/game-sample/client/dist/apps/game-sample/client/src/bootstrap.js';
import { createApp } from '../services/api-server/dist/services/api-server/src/app.js';

const databaseFilePath = `/tmp/mini-game-workflow-minimal-${Date.now()}-${Math.random().toString(36).slice(2)}.sqlite`;
const app = createApp({
  database: {
    filePath: databaseFilePath
  }
});
const { runtime, session } = await bootstrapGameSample({
  baseURL: 'http://local.app',
  fetchImpl: app.fetch
});

const adEnabled = runtime.config.get((config) => config.ad.enabled);

if (adEnabled !== false) {
  throw new Error(`Expected remote config to override ad.enabled to false, got ${String(adEnabled)}`);
}

await runtime.save.replace({
  coins: 8,
  level: 2
});

const currentSave = runtime.save.getAll();
await runtime.network.request({
  path: '/api/save',
  method: 'POST',
  requiresAuth: true,
  body: {
    save: {
      schemaVersion: currentSave.schemaVersion,
      data: currentSave.data
    }
  }
});

const roundTrip = await runtime.network.request({
  path: '/api/save',
  method: 'GET',
  requiresAuth: true
});

if (!roundTrip.save) {
  throw new Error('Expected save to exist after POST /api/save');
}

if (roundTrip.save.data.coins !== 8 || roundTrip.save.data.level !== 2) {
  throw new Error(`Unexpected save data: ${JSON.stringify(roundTrip.save.data)}`);
}

runtime.analytics.track({
  eventName: 'verify_flow_ping',
  eventData: {
    phase: 'post-save'
  }
});
await runtime.analytics.flush();

const adResult = await runtime.ad.showRewardedVideo('doubleCoinReward');
const verification = await runtime.network.request({
  path: '/api/ad/verify',
  method: 'POST',
  requiresAuth: true,
  body: {
    sceneKey: adResult.sceneKey,
    adType: adResult.adType,
    platformResult: {
      completed: adResult.completed
    }
  }
});

const reward = await runtime.network.request({
  path: '/api/reward/claim',
  method: 'POST',
  requiresAuth: true,
  body: {
    rewardType: 'gold',
    amount: 100,
    reason: 'reward_ad',
    bizId: verification.verificationId
  }
});

const rewardDuplicate = await runtime.network.request({
  path: '/api/reward/claim',
  method: 'POST',
  requiresAuth: true,
  body: {
    rewardType: 'gold',
    amount: 100,
    reason: 'reward_ad',
    bizId: verification.verificationId
  }
});

const secondLoginResponse = await app.fetch('http://local.app/api/auth/login', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json'
  },
  body: JSON.stringify({
    gameKey: 'game_sample',
    platform: 'web',
    code: 'verify-flow-second-user',
    clientVersion: '0.1.0'
  })
});
const secondLoginPayload = await secondLoginResponse.json();

const rewardHijackResponse = await app.fetch('http://local.app/api/reward/claim', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${secondLoginPayload.data.token}`
  },
  body: JSON.stringify({
    rewardType: 'gold',
    amount: 100,
    reason: 'reward_ad',
    bizId: verification.verificationId
  })
});
const rewardHijackPayload = await rewardHijackResponse.json();

if (reward.balanceAfter !== 100 || rewardDuplicate.balanceAfter !== 100) {
  throw new Error(`Unexpected reward balance: ${JSON.stringify({ reward, rewardDuplicate })}`);
}

if (rewardHijackResponse.ok || rewardHijackPayload.success || rewardHijackPayload.code !== 'AD_VERIFY_FAILED') {
  throw new Error(`Expected cross-user reward claim to fail: ${JSON.stringify(rewardHijackPayload)}`);
}

console.log(
  JSON.stringify(
    {
      databaseFilePath,
      userId: session.user.id,
      token: session.token,
      configVersion: runtime.config.getVersion(),
      adEnabled,
      save: roundTrip.save,
      verification,
      reward,
      rewardDuplicate,
      rewardHijack: rewardHijackPayload
    },
    null,
    2
  )
);

app.close();
