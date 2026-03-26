import { startDevStack } from './dev-stack-lib.mjs';

function readNumberEnv(name, fallback) {
  const raw = process.env[name];

  if (!raw) {
    return fallback;
  }

  const parsed = Number(raw);
  return Number.isFinite(parsed) ? parsed : fallback;
}

const stack = await startDevStack({
  host: process.env.MINI_GAME_WORKFLOW_HOST ?? '127.0.0.1',
  apiPort: readNumberEnv('MINI_GAME_WORKFLOW_API_PORT', 3000),
  shellPort: readNumberEnv('MINI_GAME_WORKFLOW_SHELL_PORT', 3100),
  databaseFilePath: process.env.MINI_GAME_WORKFLOW_DB
});

console.log(
  JSON.stringify(
    {
      apiURL: stack.apiURL,
      shellURL: stack.shellURL,
      databaseFilePath: stack.databaseFilePath
    },
    null,
    2
  )
);

let closed = false;

async function shutdown(signal) {
  if (closed) {
    return;
  }

  closed = true;
  await stack.close();
  console.log(`dev stack stopped by ${signal}`);
  process.exit(0);
}

process.on('SIGINT', () => {
  void shutdown('SIGINT');
});

process.on('SIGTERM', () => {
  void shutdown('SIGTERM');
});

await new Promise(() => {});
