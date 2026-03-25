import { bootstrapGameSample } from '../apps/game-sample/client/src/bootstrap';
import { createApp } from '../services/api-server/src/app';
import { initAdminApiClient } from '../services/admin-web/src/services/api-client';
import { fetchRewardLogs } from '../services/admin-web/src/services/reward-logs';
import { fetchUsers } from '../services/admin-web/src/services/users';

async function main(): Promise<void> {
  const databaseFilePath = `/tmp/mini-game-workflow-persistence-${Date.now()}-${Math.random().toString(36).slice(2)}.sqlite`;
  const app1 = createApp({
    database: {
      filePath: databaseFilePath
    }
  });

  const first = await bootstrapGameSample({
    baseURL: 'http://local.app',
    fetchImpl: app1.fetch
  });

  await first.runtime.save.replace({
    coins: 33,
    level: 4
  });

  const firstSave = first.runtime.save.getAll();
  await first.runtime.network.request({
    path: '/api/save',
    method: 'POST',
    requiresAuth: true,
    body: {
      save: {
        schemaVersion: firstSave.schemaVersion,
        data: firstSave.data
      }
    }
  });

  const firstAd = await first.runtime.ad.showRewardedVideo('doubleCoinReward');
  const verification = await first.runtime.network.request<{
    verificationId: string;
  }>({
    path: '/api/ad/verify',
    method: 'POST',
    requiresAuth: true,
    body: {
      sceneKey: firstAd.sceneKey,
      adType: firstAd.adType,
      platformResult: {
        completed: firstAd.completed
      }
    }
  });

  await first.runtime.network.request({
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

  app1.close();

  const app2 = createApp({
    database: {
      filePath: databaseFilePath
    }
  });
  initAdminApiClient({
    baseURL: 'http://local.app',
    adminToken: 'dev-admin-token',
    fetchImpl: app2.fetch
  });

  const second = await bootstrapGameSample({
    baseURL: 'http://local.app',
    fetchImpl: app2.fetch
  });

  const restoredSave = second.runtime.save.getAll();
  const [users, rewardLogs] = await Promise.all([
    fetchUsers({
      gameKey: 'game_sample'
    }),
    fetchRewardLogs({
      gameKey: 'game_sample',
      gameUserId: second.session.user.id
    })
  ]);

  if (second.session.isNewUser) {
    throw new Error('Expected persisted user to be reused after app restart.');
  }

  if (restoredSave.data.coins !== 33 || restoredSave.data.level !== 4) {
    throw new Error(`Unexpected restored save: ${JSON.stringify(restoredSave)}`);
  }

  if (users.total !== 1 || rewardLogs.total !== 1) {
    throw new Error(`Unexpected persisted admin state: ${JSON.stringify({ users, rewardLogs })}`);
  }

  console.log(
    JSON.stringify(
      {
        databaseFilePath,
        reusedUserId: second.session.user.id,
        restoredSave,
        rewardLog: rewardLogs.items[0]
      },
      null,
      2
    )
  );

  app2.close();
}

void main();
