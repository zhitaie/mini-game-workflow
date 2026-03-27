import { createApp } from '../services/api-server/dist/services/api-server/src/app.js';
import { bootstrapAndRenderAdminApp } from '../services/admin-web/dist/services/admin-web/src/main.js';
import { initAdminApiClient } from '../services/admin-web/dist/services/admin-web/src/services/api-client.js';
import { loginAdmin } from './lib/admin-auth.mjs';
import { fetchAuditLogs } from '../services/admin-web/dist/services/admin-web/src/services/audit-logs.js';
import {
  archiveConfig,
  fetchConfigs,
  publishConfig,
  saveConfigDraft
} from '../services/admin-web/dist/services/admin-web/src/services/configs.js';
import { fetchNotices, saveNotice, setNoticeStatus } from '../services/admin-web/dist/services/admin-web/src/services/notices.js';

const databaseFilePath = `/tmp/mini-game-workflow-admin-mutations-${Date.now()}-${Math.random().toString(36).slice(2)}.sqlite`;
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

const draft = await saveConfigDraft({
  gameKey: 'game_sample',
  platform: 'web',
  configVersion: 'verify-web-v2',
  minClientVersion: '1.0.0',
  maxClientVersion: '1.9.0',
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
  adminToken: adminLogin.session.token,
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

if (!configsRender.html.includes('#/audit-logs?gameKey=game_sample&amp;targetType=game_config&amp;targetKey=game_sample%3Aweb%3Averify-web-v2')) {
  throw new Error(`Expected config render to include audit link: ${configsRender.html}`);
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

const activeSeed = configs.items.find((item) => item.configVersion === 'seed-web-v1');
const activeV2 = configs.items.find((item) => item.configVersion === 'verify-web-v2');

if (!draft.item || published.item.configVersion !== 'verify-web-v2') {
  throw new Error(`Unexpected config mutation result: ${JSON.stringify({ draft, published })}`);
}

if (!activeSeed || activeSeed.status !== 'active' || !activeV2 || activeV2.status !== 'active') {
  throw new Error(`Unexpected config list after publish: ${JSON.stringify(configs)}`);
}

const seedConfigResponse = await app.fetch('http://local.app/api/config?gameKey=game_sample&platform=web&clientVersion=0.5.0');
const seedConfigPayload = await seedConfigResponse.json();

if (!seedConfigResponse.ok || !seedConfigPayload.success || seedConfigPayload.data.configVersion !== 'seed-web-v1') {
  throw new Error(`Expected seed config to match old client version: ${JSON.stringify(seedConfigPayload)}`);
}

const v2ConfigResponse = await app.fetch('http://local.app/api/config?gameKey=game_sample&platform=web&clientVersion=1.2.0');
const v2ConfigPayload = await v2ConfigResponse.json();

if (!v2ConfigResponse.ok || !v2ConfigPayload.success || v2ConfigPayload.data.configVersion !== 'verify-web-v2') {
  throw new Error(`Expected v2 config to match new client version: ${JSON.stringify(v2ConfigPayload)}`);
}

const overlapDraft = await saveConfigDraft({
  gameKey: 'game_sample',
  platform: 'web',
  configVersion: 'verify-web-overlap',
  minClientVersion: '0.8.0',
  maxClientVersion: '1.2.0',
  payloadJson: JSON.stringify({
    ad: {
      enabled: false
    }
  })
});

let overlapPublishError = null;

try {
  await publishConfig({
    gameKey: 'game_sample',
    platform: 'web',
    configVersion: 'verify-web-overlap'
  });
} catch (error) {
  overlapPublishError = error instanceof Error ? error.message : String(error);
}

if (!overlapDraft.item || !overlapPublishError || !overlapPublishError.includes('overlaps active config')) {
  throw new Error(`Expected overlapping publish to fail: ${JSON.stringify({ overlapDraft, overlapPublishError })}`);
}

const archivedV2 = await archiveConfig({
  gameKey: 'game_sample',
  platform: 'web',
  configVersion: 'verify-web-v2'
});

if (archivedV2.item.status !== 'archived') {
  throw new Error(`Expected archived config status: ${JSON.stringify(archivedV2)}`);
}

const archivedConfigs = await fetchConfigs({
  gameKey: 'game_sample',
  platform: 'web'
});
const archivedV2Record = archivedConfigs.items.find((item) => item.configVersion === 'verify-web-v2');

if (!archivedV2Record || archivedV2Record.status !== 'archived') {
  throw new Error(`Expected archived v2 config in list: ${JSON.stringify(archivedConfigs)}`);
}

const archivedV2Response = await app.fetch('http://local.app/api/config?gameKey=game_sample&platform=web&clientVersion=1.2.0');
const archivedV2Payload = await archivedV2Response.json();

if (archivedV2Response.ok || archivedV2Payload.success || archivedV2Payload.code !== 'BAD_REQUEST') {
  throw new Error(`Expected archived client range to become unavailable: ${JSON.stringify(archivedV2Payload)}`);
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
  gameKey: 'game_sample',
  id: createdNotice.item.id,
  status: 'active'
});

let wrongGameStatusError = null;

try {
  await setNoticeStatus({
    gameKey: 'wrong_game',
    id: createdNotice.item.id,
    status: 'archived'
  });
} catch (error) {
  wrongGameStatusError = error instanceof Error ? error.message : String(error);
}

const notices = await fetchNotices({
  gameKey: 'game_sample'
});

const notice = notices.items.find((item) => item.id === createdNotice.item.id);

if (!notice || notice.title !== '运维公告已更新' || activatedNotice.item.status !== 'active') {
  throw new Error(`Unexpected notice mutation result: ${JSON.stringify({ updatedNotice, activatedNotice, notices })}`);
}

if (!wrongGameStatusError || !wrongGameStatusError.includes('notice not found')) {
  throw new Error(`Expected wrong-game notice status mutation to fail: ${String(wrongGameStatusError)}`);
}

const configAuditLogs = await fetchAuditLogs({
  gameKey: 'game_sample',
  targetType: 'game_config',
  targetKey: 'game_sample:web:verify-web-v2'
});
const noticeAuditLogs = await fetchAuditLogs({
  gameKey: 'game_sample',
  targetType: 'notice',
  targetKey: String(createdNotice.item.id)
});

if (
  !configAuditLogs.items.some((item) => item.action === 'config.publish') ||
  !configAuditLogs.items.some((item) => item.action === 'config.archive')
) {
  throw new Error(`Expected config audit chain to be present: ${JSON.stringify(configAuditLogs)}`);
}

if (
  !noticeAuditLogs.items.some((item) => item.action === 'notice.create') ||
  !noticeAuditLogs.items.some((item) => item.action === 'notice.update') ||
  !noticeAuditLogs.items.some((item) => item.action === 'notice.set_status')
) {
  throw new Error(`Expected notice audit chain to be present: ${JSON.stringify(noticeAuditLogs)}`);
}

const noticesRender = await bootstrapAndRenderAdminApp({
  baseURL: 'http://local.app',
  adminToken: adminLogin.session.token,
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

if (!noticesRender.html.includes(`#/audit-logs?gameKey=game_sample&amp;targetType=notice&amp;targetKey=${createdNotice.item.id}`)) {
  throw new Error(`Expected notice render to include audit link: ${noticesRender.html}`);
}

console.log(
  JSON.stringify(
    {
      databaseFilePath,
      draftConfig: draft.item,
      activeSeed,
      activeV2,
      overlapPublishError,
      archivedV2: archivedV2.item,
      updatedNotice: updatedNotice.item,
      activatedNotice: activatedNotice.item,
      configAuditCount: configAuditLogs.total,
      noticeAuditCount: noticeAuditLogs.total,
      wrongGameStatusError,
      renderedConfigContainsForm: true,
      renderedNoticeContainsEditForm: true,
      renderedConfigContainsAuditLink: true,
      renderedNoticeContainsAuditLink: true
    },
    null,
    2
  )
);

app.close();
