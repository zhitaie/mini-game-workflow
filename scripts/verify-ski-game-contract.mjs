import assert from 'node:assert/strict';
import { createApp } from '../services/api-server/dist/services/api-server/src/app.js';

const databaseFilePath = `/tmp/mini-game-workflow-ski-contract-${Date.now()}-${Math.random().toString(36).slice(2)}.sqlite`;
const app = createApp({
  database: {
    filePath: databaseFilePath
  }
});

async function api(path, options = {}) {
  const response = await app.fetch(`http://local.app${path}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...options.headers
    }
  });
  const payload = await response.json();

  return { response, payload };
}

async function login(code) {
  const { response, payload } = await api('/api/auth/login', {
    method: 'POST',
    body: JSON.stringify({
      gameKey: 'ski_endless',
      platform: 'web',
      code,
      clientVersion: '0.1.0'
    })
  });

  assert.equal(response.ok, true);
  assert.equal(payload.success, true);

  return payload.data;
}

async function saveRun(token, bestDistance, bestScore) {
  const { response, payload } = await api('/api/save', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`
    },
    body: JSON.stringify({
      save: {
        schemaVersion: 1,
        data: {
          coins: 0,
          bestDistance,
          bestScore,
          selectedMode: 'endless',
          selectedMap: 'snowfield'
        }
      }
    })
  });

  assert.equal(response.ok, true);
  assert.equal(payload.success, true);
}

try {
  const firstSession = await login('ski-contract-first-player');
  const secondSession = await login('ski-contract-second-player');

  await saveRun(firstSession.token, 640, 640);
  await saveRun(secondSession.token, 920, 920);

  const { response: noticesResponse, payload: noticesPayload } = await api('/api/notice?gameKey=ski_endless');
  assert.equal(noticesResponse.ok, true);
  assert.equal(noticesPayload.success, true);
  assert.equal(noticesPayload.data.gameKey, 'ski_endless');
  assert.ok(
    noticesPayload.data.items.some((item) => item.title === '雪场开放中'),
    `Expected ski notice: ${JSON.stringify(noticesPayload)}`
  );

  const { response: rankResponse, payload: rankPayload } = await api('/api/rank?gameKey=ski_endless&limit=1', {
    headers: {
      Authorization: `Bearer ${firstSession.token}`
    }
  });
  assert.equal(rankResponse.ok, true);
  assert.equal(rankPayload.success, true);
  assert.equal(rankPayload.data.items.length, 1);
  assert.equal(rankPayload.data.items[0].gameUserId, secondSession.user.id);
  assert.equal(rankPayload.data.items[0].bestDistance, 920);
  assert.deepEqual(rankPayload.data.currentUser, {
    rank: 2,
    gameUserId: firstSession.user.id,
    nickname: `Rider ${firstSession.user.id}`,
    bestDistance: 640,
    bestScore: 640
  });

  const { response: reviveResponse, payload: revivePayload } = await api('/api/ad/verify', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${firstSession.token}`
    },
    body: JSON.stringify({
      sceneKey: 'ski_revive',
      adType: 'rewardedVideo',
      platformResult: {
        completed: true
      }
    })
  });
  assert.equal(reviveResponse.ok, true);
  assert.equal(revivePayload.data.sceneKey, 'ski_revive');
  assert.equal(revivePayload.data.completed, true);

  const { payload: doubleCoinVerification } = await api('/api/ad/verify', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${firstSession.token}`
    },
    body: JSON.stringify({
      sceneKey: 'ski_double_coin',
      adType: 'rewardedVideo',
      platformResult: {
        completed: true
      }
    })
  });
  assert.equal(doubleCoinVerification.success, true);
  assert.equal(doubleCoinVerification.data.sceneKey, 'ski_double_coin');

  const rewardRequest = {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${firstSession.token}`
    },
    body: JSON.stringify({
      rewardType: 'gold',
      amount: 12,
      reason: 'reward_ad',
      bizId: doubleCoinVerification.data.verificationId
    })
  };
  const { response: rewardResponse, payload: rewardPayload } = await api('/api/reward/claim', rewardRequest);
  const { response: duplicateRewardResponse, payload: duplicateRewardPayload } = await api('/api/reward/claim', rewardRequest);
  assert.equal(rewardResponse.ok, true);
  assert.equal(rewardPayload.data.balanceAfter, 12);
  assert.equal(duplicateRewardResponse.ok, true);
  assert.equal(duplicateRewardPayload.data.balanceAfter, 12);

  const { response: incompleteAdResponse, payload: incompleteAdPayload } = await api('/api/ad/verify', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${firstSession.token}`
    },
    body: JSON.stringify({
      sceneKey: 'ski_double_coin',
      adType: 'rewardedVideo',
      platformResult: {
        completed: false
      }
    })
  });
  assert.equal(incompleteAdResponse.ok, true);
  assert.equal(incompleteAdPayload.data.completed, false);

  const { response: incompleteClaimResponse, payload: incompleteClaimPayload } = await api('/api/reward/claim', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${firstSession.token}`
    },
    body: JSON.stringify({
      rewardType: 'gold',
      amount: 12,
      reason: 'reward_ad',
      bizId: incompleteAdPayload.data.verificationId
    })
  });
  assert.equal(incompleteClaimResponse.ok, false);
  assert.equal(incompleteClaimPayload.code, 'AD_VERIFY_FAILED');

  const { response: hijackResponse, payload: hijackPayload } = await api('/api/reward/claim', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${secondSession.token}`
    },
    body: JSON.stringify({
      rewardType: 'gold',
      amount: 12,
      reason: 'reward_ad',
      bizId: doubleCoinVerification.data.verificationId
    })
  });
  assert.equal(hijackResponse.ok, false);
  assert.equal(hijackPayload.code, 'AD_VERIFY_FAILED');

  console.log(
    JSON.stringify(
      {
        databaseFilePath,
        notices: noticesPayload.data.items.length,
        leaderboardTopUserId: rankPayload.data.items[0].gameUserId,
        currentUserRank: rankPayload.data.currentUser.rank,
        reviveVerificationId: revivePayload.data.verificationId,
        doubleCoinBalance: rewardPayload.data.balanceAfter
      },
      null,
      2
    )
  );
} finally {
  app.close();
}
