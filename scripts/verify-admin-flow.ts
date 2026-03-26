import { bootstrapGameSample } from '../apps/game-sample/client/src/bootstrap';
import { loginAdmin } from './lib/admin-auth';
import { createApp } from '../services/api-server/src/app';
import { initAdminApiClient } from '../services/admin-web/src/services/api-client';
import { fetchAdLogs } from '../services/admin-web/src/services/ad-logs';
import { fetchAnalyticsEvents } from '../services/admin-web/src/services/analytics';
import { fetchConfigs } from '../services/admin-web/src/services/configs';
import { fetchDashboardSummary } from '../services/admin-web/src/services/dashboard';
import { fetchNotices } from '../services/admin-web/src/services/notices';
import { fetchRewardLogs } from '../services/admin-web/src/services/reward-logs';
import { fetchUsers } from '../services/admin-web/src/services/users';

async function main(): Promise<void> {
  const databaseFilePath = `/tmp/mini-game-workflow-admin-${Date.now()}-${Math.random().toString(36).slice(2)}.sqlite`;
  const app = createApp({
    database: {
      filePath: databaseFilePath
    }
  });
  const adminLogin = await loginAdmin({
    baseURL: 'http://local.app',
    fetchImpl: app.fetch
  });
  initAdminApiClient({
    baseURL: 'http://local.app',
    adminToken: adminLogin.session.token,
    fetchImpl: app.fetch
  });

  const { runtime, session } = await bootstrapGameSample({
    baseURL: 'http://local.app',
    fetchImpl: app.fetch
  });

  runtime.analytics.track({
    eventName: 'admin_verify_ping',
    eventData: {
      source: 'verify-admin-flow'
    }
  });
  await runtime.analytics.flush();

  const adResult = await runtime.ad.showRewardedVideo('doubleCoinReward');
  const verification = await runtime.network.request<{
    verificationId: string;
  }>({
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

  await runtime.network.request({
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

  const [dashboard, users, configs, notices, adLogs, rewardLogs, analytics] = await Promise.all([
    fetchDashboardSummary('game_sample'),
    fetchUsers({
      gameKey: 'game_sample'
    }),
    fetchConfigs({
      gameKey: 'game_sample'
    }),
    fetchNotices({
      gameKey: 'game_sample'
    }),
    fetchAdLogs({
      gameKey: 'game_sample',
      gameUserId: session.user.id
    }),
    fetchRewardLogs({
      gameKey: 'game_sample',
      gameUserId: session.user.id
    }),
    fetchAnalyticsEvents({
      gameKey: 'game_sample',
      gameUserId: session.user.id,
      eventName: 'admin_verify_ping'
    })
  ]);

  if (dashboard.totalUsers !== 1 || dashboard.adVerifyCount !== 1 || dashboard.rewardCount !== 1 || dashboard.analyticsEventCount < 1) {
    throw new Error(`Unexpected dashboard summary: ${JSON.stringify(dashboard)}`);
  }

  if (users.total !== 1 || configs.total !== 1 || notices.total !== 1) {
    throw new Error(`Unexpected admin base lists: ${JSON.stringify({ users, configs, notices })}`);
  }

  if (adLogs.total !== 1 || rewardLogs.total !== 1 || analytics.total !== 1) {
    throw new Error(`Unexpected admin log lists: ${JSON.stringify({ adLogs, rewardLogs, analytics })}`);
  }

  console.log(
    JSON.stringify(
      {
        databaseFilePath,
        dashboard,
        user: users.items[0],
        config: configs.items[0],
        notice: notices.items[0],
        adLog: adLogs.items[0],
        rewardLog: rewardLogs.items[0],
        analyticsEvent: analytics.items[0]
      },
      null,
      2
    )
  );

  app.close();
}

void main();
