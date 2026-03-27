import { bootstrapGameSample } from '../apps/game-sample/client/dist/apps/game-sample/client/src/bootstrap.js';
import { loginAdmin } from './lib/admin-auth.mjs';
import { createApp } from '../services/api-server/dist/services/api-server/src/app.js';
import { bootstrapAdminApp, bootstrapAndRenderAdminApp } from '../services/admin-web/dist/services/admin-web/src/main.js';

const databaseFilePath = `/tmp/mini-game-workflow-admin-filters-${Date.now()}-${Math.random().toString(36).slice(2)}.sqlite`;
const app = createApp({
  database: {
    filePath: databaseFilePath
  }
});

const { runtime, session } = await bootstrapGameSample({
  baseURL: 'http://local.app',
  fetchImpl: app.fetch
});
const adminLogin = await loginAdmin({
  baseURL: 'http://local.app',
  fetchImpl: app.fetch
});

runtime.analytics.track({
  eventName: 'admin_filter_ping',
  eventData: {
    source: 'verify-admin-filters'
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

await runtime.network.request({
  path: '/api/reward/claim',
  method: 'POST',
  requiresAuth: true,
  body: {
    rewardType: 'gold',
    amount: 30,
    reason: 'reward_ad',
    bizId: verification.verificationId
  }
});

const auditTargetKey = 'game_sample:web:audit-filter-v1';
const auditSeedResponse = await app.fetch('http://local.app/api/admin/configs/draft', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'x-admin-token': adminLogin.session.token
  },
  body: JSON.stringify({
    gameKey: 'game_sample',
    platform: 'web',
    configVersion: 'audit-filter-v1',
    minClientVersion: '3.0.0',
    maxClientVersion: '3.9.9',
    payload: {
      featureFlags: {
        auditFilter: true
      }
    }
  })
});
const auditSeedPayload = await auditSeedResponse.json();

if (!auditSeedResponse.ok || !auditSeedPayload.success) {
  throw new Error(`Expected audit seed config draft to succeed: ${JSON.stringify(auditSeedPayload)}`);
}

const usersPage = await bootstrapAdminApp({
  baseURL: 'http://local.app',
  adminToken: adminLogin.session.token,
  fetchImpl: app.fetch,
  gameKey: 'game_sample',
  route: '/users',
  query: {
    platform: 'web',
    platformOpenId: 'web:web-mock-login-code',
    status: 'active'
  }
});

const adLogsPage = await bootstrapAdminApp({
  baseURL: 'http://local.app',
  adminToken: adminLogin.session.token,
  fetchImpl: app.fetch,
  gameKey: 'game_sample',
  route: '/ad-logs',
  query: {
    gameUserId: String(session.user.id),
    verified: 'true',
    completed: 'true'
  }
});

const rewardLogsPage = await bootstrapAdminApp({
  baseURL: 'http://local.app',
  adminToken: adminLogin.session.token,
  fetchImpl: app.fetch,
  gameKey: 'game_sample',
  route: '/reward-logs',
  query: {
    gameUserId: String(session.user.id),
    reason: 'reward_ad'
  }
});

const analyticsPage = await bootstrapAdminApp({
  baseURL: 'http://local.app',
  adminToken: adminLogin.session.token,
  fetchImpl: app.fetch,
  gameKey: 'game_sample',
  route: '/analytics',
  query: {
    gameUserId: String(session.user.id),
    eventName: 'admin_filter_ping'
  }
});

const configsPage = await bootstrapAdminApp({
  baseURL: 'http://local.app',
  adminToken: adminLogin.session.token,
  fetchImpl: app.fetch,
  gameKey: 'game_sample',
  route: '/configs',
  query: {
    platform: 'web',
    status: 'active'
  }
});

const noticesPage = await bootstrapAdminApp({
  baseURL: 'http://local.app',
  adminToken: adminLogin.session.token,
  fetchImpl: app.fetch,
  gameKey: 'game_sample',
  route: '/notices',
  query: {
    status: 'active'
  }
});

const auditLogsPage = await bootstrapAdminApp({
  baseURL: 'http://local.app',
  adminToken: adminLogin.session.token,
  fetchImpl: app.fetch,
  gameKey: 'game_sample',
  route: '/audit-logs',
  query: {
    action: 'config.save_draft',
    targetType: 'game_config',
    targetKey: auditTargetKey
  }
});

if (!usersPage.page.forms || usersPage.page.forms[0]?.kind !== 'query' || usersPage.page.table?.rows.length !== 1) {
  throw new Error(`Unexpected users filtered page: ${JSON.stringify(usersPage)}`);
}

if (!adLogsPage.page.table || adLogsPage.page.table.rows.length !== 1) {
  throw new Error(`Unexpected ad log filtered page: ${JSON.stringify(adLogsPage)}`);
}

if (!rewardLogsPage.page.table || rewardLogsPage.page.table.rows.length !== 1) {
  throw new Error(`Unexpected reward log filtered page: ${JSON.stringify(rewardLogsPage)}`);
}

if (!analyticsPage.page.table || analyticsPage.page.table.rows.length !== 1) {
  throw new Error(`Unexpected analytics filtered page: ${JSON.stringify(analyticsPage)}`);
}

if (!configsPage.page.forms || configsPage.page.forms.length < 2 || configsPage.page.forms[0]?.kind !== 'query') {
  throw new Error(`Unexpected configs page forms: ${JSON.stringify(configsPage)}`);
}

if (!noticesPage.page.forms || noticesPage.page.forms.length < 2 || noticesPage.page.forms[0]?.kind !== 'query') {
  throw new Error(`Unexpected notices page forms: ${JSON.stringify(noticesPage)}`);
}

if (!auditLogsPage.page.table || auditLogsPage.page.table.rows.length !== 1) {
  throw new Error(`Unexpected audit log filtered page: ${JSON.stringify(auditLogsPage)}`);
}

const rendered = await bootstrapAndRenderAdminApp({
  baseURL: 'http://local.app',
  adminToken: adminLogin.session.token,
  fetchImpl: app.fetch,
  gameKey: 'game_sample',
  route: '/ad-logs',
  query: {
    gameUserId: String(session.user.id),
    verified: 'true'
  },
  target: {
    innerHTML: ''
  }
});

if (!rendered.html.includes('data-admin-form-kind="query"') || !rendered.html.includes('data-admin-form-route="/ad-logs"')) {
  throw new Error(`Expected query form markers in rendered admin html: ${rendered.html}`);
}

if (!rendered.html.includes('清空筛选') || !rendered.html.includes('#/ad-logs?gameKey=game_sample')) {
  throw new Error(`Expected reset filter link in rendered admin html: ${rendered.html}`);
}

if (!rendered.html.includes('#/reward-logs?gameKey=game_sample&amp;gameUserId=1')) {
  throw new Error(`Expected reward log nav context in rendered admin html: ${rendered.html}`);
}

if (!rendered.html.includes('#/analytics?gameKey=game_sample&amp;gameUserId=1')) {
  throw new Error(`Expected analytics nav context in rendered admin html: ${rendered.html}`);
}

const renderedAudit = await bootstrapAndRenderAdminApp({
  baseURL: 'http://local.app',
  adminToken: adminLogin.session.token,
  fetchImpl: app.fetch,
  gameKey: 'game_sample',
  route: '/configs',
  query: {
    platform: 'web'
  },
  target: {
    innerHTML: ''
  }
});

if (
  !renderedAudit.html.includes('#/audit-logs?gameKey=game_sample&amp;targetType=game_config&amp;targetKey=game_sample%3Aweb%3Aaudit-filter-v1')
) {
  throw new Error(`Expected config page to contain audit log link: ${renderedAudit.html}`);
}

console.log(
  JSON.stringify(
    {
      databaseFilePath,
      filteredUsers: usersPage.page.table.rows.length,
      filteredAdLogs: adLogsPage.page.table.rows.length,
      filteredRewardLogs: rewardLogsPage.page.table.rows.length,
      filteredAnalytics: analyticsPage.page.table.rows.length,
      filteredAuditLogs: auditLogsPage.page.table.rows.length,
      configsFormKinds: configsPage.page.forms.map((form) => form.kind),
      noticesFormKinds: noticesPage.page.forms.map((form) => form.kind),
      renderedContainsQueryForm: true,
      renderedContainsResetLink: true,
      renderedPreservesUserContextAcrossNav: true,
      renderedConfigContainsAuditLink: true
    },
    null,
    2
  )
);

app.close();
