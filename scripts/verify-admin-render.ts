import { bootstrapGameSample } from '../apps/game-sample/client/src/bootstrap';
import { createApp } from '../services/api-server/src/app';
import { bootstrapAndRenderAdminApp } from '../services/admin-web/src/main';

async function main(): Promise<void> {
  const databaseFilePath = `/tmp/mini-game-workflow-admin-render-${Date.now()}-${Math.random().toString(36).slice(2)}.sqlite`;
  const app = createApp({
    database: {
      filePath: databaseFilePath
    }
  });

  await bootstrapGameSample({
    baseURL: 'http://local.app',
    fetchImpl: app.fetch
  });

  const target = {
    innerHTML: ''
  };

  const rendered = await bootstrapAndRenderAdminApp({
    baseURL: 'http://local.app',
    adminToken: 'dev-admin-token',
    fetchImpl: app.fetch,
    gameKey: 'game_sample',
    route: '/users',
    target
  });

  if (!rendered.html.includes('用户查询') || !rendered.html.includes('web:web-mock-login-code')) {
    throw new Error(`Unexpected admin render output: ${rendered.html}`);
  }

  if (!rendered.html.includes('#/ad-logs?gameKey=game_sample&amp;gameUserId=1')) {
    throw new Error(`Expected action link in render output: ${rendered.html}`);
  }

  if (target.innerHTML !== rendered.html) {
    throw new Error('Expected mounted HTML to match rendered HTML.');
  }

  console.log(
    JSON.stringify(
      {
        databaseFilePath,
        route: rendered.snapshot.currentRoute,
        title: rendered.snapshot.page.title,
        htmlLength: rendered.html.length,
        containsUsersLabel: rendered.html.includes('用户查询'),
        containsActionHref: rendered.html.includes('#/ad-logs?gameKey=game_sample&amp;gameUserId=1')
      },
      null,
      2
    )
  );

  app.close();
}

void main();
