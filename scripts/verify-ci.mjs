import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const ROOT_DIR = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const VERIFICATION_SCRIPTS = [
  'verify:minimal',
  'verify:save-migration',
  'verify:analytics-retry',
  'verify:wechat-platform',
  'verify:http',
  'verify:sample-browser',
  'verify:dev-stack',
  'verify:persistence',
  'verify:admin',
  'verify:admin-authz',
  'verify:admin-filters',
  'verify:admin-mutations',
  'verify:admin-shell',
  'verify:admin-render'
];

function runVerification(scriptName) {
  return new Promise((resolvePromise, rejectPromise) => {
    const child = spawn('npm', ['run', scriptName], {
      cwd: ROOT_DIR,
      stdio: 'inherit',
      env: process.env
    });

    child.on('error', rejectPromise);
    child.on('exit', (code) => {
      if (code === 0) {
        resolvePromise();
        return;
      }

      rejectPromise(new Error(`Verification failed: ${scriptName} (exit code ${String(code)})`));
    });
  });
}

for (const scriptName of VERIFICATION_SCRIPTS) {
  console.log(`[verify-ci] ${scriptName}`);
  await runVerification(scriptName);
}
