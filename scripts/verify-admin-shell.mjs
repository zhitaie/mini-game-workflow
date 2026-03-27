import { bootstrapGameSample } from '../apps/game-sample/client/dist/apps/game-sample/client/src/bootstrap.js';
import { loginAdmin } from './lib/admin-auth.mjs';
import { createApp } from '../services/api-server/dist/services/api-server/src/app.js';
import { bootstrapAdminApp } from '../services/admin-web/dist/services/admin-web/src/main.js';

const databaseFilePath = `/tmp/mini-game-workflow-admin-shell-${Date.now()}-${Math.random().toString(36).slice(2)}.sqlite`;
const app = createApp({
  database: {
    filePath: databaseFilePath
  }
});

const { session } = await bootstrapGameSample({
  baseURL: 'http://local.app',
  fetchImpl: app.fetch
});
const adminLogin = await loginAdmin({
  baseURL: 'http://local.app',
  fetchImpl: app.fetch
});

const rewardVerification = await bootstrapAdminApp({
  baseURL: 'http://local.app',
  adminToken: adminLogin.session.token,
  fetchImpl: app.fetch,
  gameKey: 'game_sample',
  route: '/reward-logs',
  query: {
    gameUserId: session.user.id
  }
});

const dashboard = await bootstrapAdminApp({
  baseURL: 'http://local.app',
  adminToken: adminLogin.session.token,
  fetchImpl: app.fetch,
  gameKey: 'game_sample',
  route: '/dashboard'
});

const users = await bootstrapAdminApp({
  baseURL: 'http://local.app',
  adminToken: adminLogin.session.token,
  fetchImpl: app.fetch,
  gameKey: 'game_sample',
  route: '/users'
});

const configs = await bootstrapAdminApp({
  baseURL: 'http://local.app',
  adminToken: adminLogin.session.token,
  fetchImpl: app.fetch,
  gameKey: 'game_sample',
  route: '/configs'
});

const auditLogs = await bootstrapAdminApp({
  baseURL: 'http://local.app',
  adminToken: adminLogin.session.token,
  fetchImpl: app.fetch,
  gameKey: 'game_sample',
  route: '/audit-logs'
});

if (!dashboard.page.metrics || dashboard.page.metrics.length !== 5) {
  throw new Error(`Unexpected dashboard shell: ${JSON.stringify(dashboard)}`);
}

if (!users.page.table || users.page.table.rows.length !== 1) {
  throw new Error(`Unexpected users shell: ${JSON.stringify(users)}`);
}

if (!configs.page.table || configs.page.table.rows.length !== 1) {
  throw new Error(`Unexpected configs shell: ${JSON.stringify(configs)}`);
}

if (!rewardVerification.page.table || rewardVerification.page.table.rows.length !== 0) {
  throw new Error(`Expected reward shell to be empty before rewards exist: ${JSON.stringify(rewardVerification)}`);
}

if (!auditLogs.page.table || auditLogs.page.table.rows.length !== 0) {
  throw new Error(`Expected audit shell to be empty before admin writes exist: ${JSON.stringify(auditLogs)}`);
}

console.log(
  JSON.stringify(
    {
      databaseFilePath,
      navigationSize: dashboard.navigation.length,
      dashboardPage: dashboard.page,
      usersPage: users.page,
      configsPage: configs.page,
      auditLogsPage: auditLogs.page
    },
    null,
    2
  )
);

app.close();
