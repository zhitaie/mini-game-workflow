import { startServer } from '../services/api-server/dist/services/api-server/src/server.js';
import { bootstrapAndRenderGameSampleBrowserApp } from '../apps/game-sample/client/dist/apps/game-sample/client/src/browser.js';

const databaseFilePath = `/tmp/mini-game-workflow-sample-browser-${Date.now()}-${Math.random().toString(36).slice(2)}.sqlite`;
const server = await startServer({
  host: '127.0.0.1',
  port: 0,
  database: {
    filePath: databaseFilePath
  }
});

const target = {
  innerHTML: ''
};

const rendered = await bootstrapAndRenderGameSampleBrowserApp({
  baseURL: server.url,
  target
});

if (rendered.snapshot.gameKey !== 'game_sample' || rendered.snapshot.userId !== 1) {
  throw new Error(`Unexpected sample browser snapshot: ${JSON.stringify(rendered.snapshot)}`);
}

if (!rendered.html.includes('Game Sample Browser') || !rendered.html.includes('data-sample-action="increment-save"')) {
  throw new Error(`Unexpected sample browser render output: ${rendered.html}`);
}

if (target.innerHTML !== rendered.html) {
  throw new Error('Expected sample browser target HTML to match rendered HTML.');
}

console.log(
  JSON.stringify(
    {
      url: server.url,
      databaseFilePath,
      snapshot: rendered.snapshot,
      containsSaveAction: rendered.html.includes('data-sample-action="increment-save"'),
      containsRewardAction: rendered.html.includes('data-sample-action="reward-ad"')
    },
    null,
    2
  )
);

await server.close();
