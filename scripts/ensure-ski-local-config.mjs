import { access, copyFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT_DIR = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const CONFIG_DIR = resolve(ROOT_DIR, 'apps/ski-endless/client/assets/scripts/app');
const examplePath = resolve(CONFIG_DIR, 'SkiEndlessPlatformConfig.local.example.ts');
const localPath = resolve(CONFIG_DIR, 'SkiEndlessPlatformConfig.local.ts');

try {
  await access(localPath);
  console.log('[ski-local-config] Existing local configuration preserved.');
} catch {
  await copyFile(examplePath, localPath);
  console.log('[ski-local-config] Created ignored local configuration from the public template.');
}
