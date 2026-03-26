import { createApp } from '../services/api-server/dist/services/api-server/src/app.js';
import { bootstrapAndRenderAdminApp } from '../services/admin-web/dist/services/admin-web/src/main.js';
import { initAdminApiClient } from '../services/admin-web/dist/services/admin-web/src/services/api-client.js';
import { fetchConfigs, publishConfig, saveConfigDraft } from '../services/admin-web/dist/services/admin-web/src/services/configs.js';
import { fetchNotices, saveNotice, setNoticeStatus } from '../services/admin-web/dist/services/admin-web/src/services/notices.js';

const databaseFilePath = `/tmp/mini-game-workflow-admin-mutations-${Date.now()}-${Math.random().toString(36).slice(2)}.sqlite`;
const app = createApp({
  database: {
    filePath: databaseFilePath
  }
});

initAdminApiClient({
  baseURL: 'http://local.app',
  adminToken: 'dev-admin-token',
  fetchImpl: app.fetch
});

const draft = await saveConfigDraft({
  gameKey: 'game_sample',
  platform: 'web',
  configVersion: 'verify-web-v2',
  minClientVersion: '0.2.0',
  maxClientVersion: '1.0.0',
  payloadJson: JSON.stringify({
    ad: {
      enabled: true
    },
    featureFlags: {
      weekendBoost: true
    }
  })
});

const configsRender = await bootstrapAndRenderAdminApp({
  baseURL: 'http://local.app',
  adminToken: 'dev-admin-token',
  fetchImpl: app.fetch,
  gameKey: 'game_sample',
  route: '/configs',
  target: {
    innerHTML: ''
  }
});

if (!configsRender.html.includes('data-admin-form-action="config.saveDraft"')) {
  throw new Error(`Expected config mutation form in render output: ${configsRender.html}`);
}

if (!configsRender.html.includes('data-admin-submit-action="config.publish"')) {
  throw new Error(`Expected config publish action in render output: ${configsRender.html}`);
}

const published = await publishConfig({
  gameKey: 'game_sample',
  platform: 'web',
  configVersion: 'verify-web-v2'
});

const configs = await fetchConfigs({
  gameKey: 'game_sample',
  platform: 'web'
});

const activeConfig = configs.items.find((item) => item.status === 'active');
const archivedSeed = configs.items.find((item) => item.configVersion === 'seed-web-v1');

if (!draft.item || published.item.configVersion !== 'verify-web-v2') {
  throw new Error(`Unexpected config mutation result: ${JSON.stringify({ draft, published })}`);
}

if (!activeConfig || activeConfig.configVersion !== 'verify-web-v2' || archivedSeed?.status !== 'archived') {
  throw new Error(`Unexpected config list after publish: ${JSON.stringify(configs)}`);
}

const createdNotice = await saveNotice({
  gameKey: 'game_sample',
  title: '运维公告',
  content: '第一版公告内容',
  status: 'draft',
  startTime: '2026-03-26T09:00',
  endTime: '2026-03-30T23:59'
});

const updatedNotice = await saveNotice({
  id: createdNotice.item.id,
  gameKey: 'game_sample',
  title: '运维公告已更新',
  content: '第二版公告内容',
  status: 'draft',
  startTime: '2026-03-27T09:00',
  endTime: '2026-03-31T23:59'
});

const activatedNotice = await setNoticeStatus({
  id: createdNotice.item.id,
  status: 'active'
});

const notices = await fetchNotices({
  gameKey: 'game_sample'
});

const notice = notices.items.find((item) => item.id === createdNotice.item.id);

if (!notice || notice.title !== '运维公告已更新' || activatedNotice.item.status !== 'active') {
  throw new Error(`Unexpected notice mutation result: ${JSON.stringify({ updatedNotice, activatedNotice, notices })}`);
}

const noticesRender = await bootstrapAndRenderAdminApp({
  baseURL: 'http://local.app',
  adminToken: 'dev-admin-token',
  fetchImpl: app.fetch,
  gameKey: 'game_sample',
  route: '/notices',
  query: {
    gameKey: 'game_sample',
    editNoticeId: String(createdNotice.item.id)
  },
  target: {
    innerHTML: ''
  }
});

if (!noticesRender.html.includes('data-admin-form-action="notice.save"') || !noticesRender.html.includes('编辑公告')) {
  throw new Error(`Expected notice mutation form in render output: ${noticesRender.html}`);
}

console.log(
  JSON.stringify(
    {
      databaseFilePath,
      draftConfig: draft.item,
      activeConfig,
      archivedSeed,
      updatedNotice: updatedNotice.item,
      activatedNotice: activatedNotice.item,
      renderedConfigContainsForm: true,
      renderedNoticeContainsEditForm: true
    },
    null,
    2
  )
);

app.close();
