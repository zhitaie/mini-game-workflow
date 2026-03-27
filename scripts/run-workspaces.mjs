import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const ROOT_DIR = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const WORKSPACE_ORDER = [
  'packages/game-core-types',
  'packages/game-core-client',
  'services/api-server',
  'services/admin-web',
  'apps/game-sample/client'
];

function getWorkspaceDirs() {
  return WORKSPACE_ORDER.map((relativePath) => ({
    relativePath,
    cwd: resolve(ROOT_DIR, relativePath)
  }));
}

function runScript(scriptName, cwd) {
  return new Promise((resolvePromise, rejectPromise) => {
    const child = spawn('npm', ['run', scriptName], {
      cwd,
      stdio: 'inherit',
      env: process.env
    });

    child.on('error', rejectPromise);
    child.on('exit', (code) => {
      if (code === 0) {
        resolvePromise();
        return;
      }

      rejectPromise(new Error(`Command failed in ${cwd} with exit code ${String(code)}`));
    });
  });
}

async function main() {
  const scriptName = process.argv[2];

  if (!scriptName) {
    throw new Error('Missing script name. Usage: node scripts/run-workspaces.mjs <script>');
  }

  for (const workspace of getWorkspaceDirs()) {
    console.log(`[run-workspaces] ${workspace.relativePath} -> npm run ${scriptName}`);
    await runScript(scriptName, workspace.cwd);
  }
}

await main();
