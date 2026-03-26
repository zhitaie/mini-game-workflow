import { loginAdmin } from './lib/admin-auth.mjs';
import { createApp } from '../services/api-server/dist/services/api-server/src/app.js';

const databaseFilePath = `/tmp/mini-game-workflow-admin-authz-${Date.now()}-${Math.random().toString(36).slice(2)}.sqlite`;
const app = createApp({
  database: {
    filePath: databaseFilePath
  }
});

const badLoginResponse = await app.fetch('http://local.app/api/admin/auth/login', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json'
  },
  body: JSON.stringify({
    username: 'admin',
    password: 'wrong-password'
  })
});
const badLoginPayload = await badLoginResponse.json();

if (badLoginResponse.status !== 401 || badLoginPayload.success || badLoginPayload.code !== 'UNAUTHORIZED') {
  throw new Error(`Expected invalid admin credentials to be rejected: ${JSON.stringify(badLoginPayload)}`);
}

const superAdmin = await loginAdmin({
  baseURL: 'http://local.app',
  fetchImpl: app.fetch
});
const operator = await loginAdmin({
  baseURL: 'http://local.app',
  fetchImpl: app.fetch,
  credentials: {
    username: 'operator',
    password: 'dev-operator-password'
  }
});
const viewer = await loginAdmin({
  baseURL: 'http://local.app',
  fetchImpl: app.fetch,
  credentials: {
    username: 'viewer',
    password: 'dev-viewer-password'
  }
});

const meResponse = await app.fetch('http://local.app/api/admin/auth/me', {
  headers: {
    'x-admin-token': superAdmin.session.token
  }
});
const mePayload = await meResponse.json();

if (!meResponse.ok || !mePayload.success || mePayload.data.adminUser.username !== 'admin') {
  throw new Error(`Expected admin session profile: ${JSON.stringify(mePayload)}`);
}

const operatorDraftResponse = await app.fetch('http://local.app/api/admin/configs/draft', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'x-admin-token': operator.session.token
  },
  body: JSON.stringify({
    gameKey: 'game_sample',
    platform: 'web',
    configVersion: 'authz-web-v2',
    minClientVersion: '2.0.0',
    maxClientVersion: '2.9.9',
    payload: {
      featureFlags: {
        authzCheck: true
      }
    }
  })
});
const operatorDraftPayload = await operatorDraftResponse.json();

if (!operatorDraftResponse.ok || !operatorDraftPayload.success) {
  throw new Error(`Expected operator to save draft config: ${JSON.stringify(operatorDraftPayload)}`);
}

const operatorPublishResponse = await app.fetch('http://local.app/api/admin/configs/publish', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'x-admin-token': operator.session.token
  },
  body: JSON.stringify({
    gameKey: 'game_sample',
    platform: 'web',
    configVersion: 'authz-web-v2'
  })
});
const operatorPublishPayload = await operatorPublishResponse.json();

if (operatorPublishResponse.status !== 403 || operatorPublishResponse.ok || operatorPublishPayload.success || operatorPublishPayload.code !== 'FORBIDDEN') {
  throw new Error(`Expected operator publish to be forbidden: ${JSON.stringify(operatorPublishPayload)}`);
}

const viewerConfigReadResponse = await app.fetch('http://local.app/api/admin/configs?gameKey=game_sample', {
  headers: {
    'x-admin-token': viewer.session.token
  }
});
const viewerConfigReadPayload = await viewerConfigReadResponse.json();

if (!viewerConfigReadResponse.ok || !viewerConfigReadPayload.success || viewerConfigReadPayload.data.total < 1) {
  throw new Error(`Expected viewer to read configs: ${JSON.stringify(viewerConfigReadPayload)}`);
}

const viewerNoticeWriteResponse = await app.fetch('http://local.app/api/admin/notices/save', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'x-admin-token': viewer.session.token
  },
  body: JSON.stringify({
    gameKey: 'game_sample',
    title: 'viewer should fail',
    content: 'forbidden',
    status: 'draft'
  })
});
const viewerNoticeWritePayload = await viewerNoticeWriteResponse.json();

if (viewerNoticeWriteResponse.status !== 403 || viewerNoticeWriteResponse.ok || viewerNoticeWritePayload.success || viewerNoticeWritePayload.code !== 'FORBIDDEN') {
  throw new Error(`Expected viewer notice write to be forbidden: ${JSON.stringify(viewerNoticeWritePayload)}`);
}

const superPublishResponse = await app.fetch('http://local.app/api/admin/configs/publish', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'x-admin-token': superAdmin.session.token
  },
  body: JSON.stringify({
    gameKey: 'game_sample',
    platform: 'web',
    configVersion: 'authz-web-v2'
  })
});
const superPublishPayload = await superPublishResponse.json();

if (!superPublishResponse.ok || !superPublishPayload.success) {
  throw new Error(`Expected super admin publish to succeed: ${JSON.stringify(superPublishPayload)}`);
}

const operatorNoticeResponse = await app.fetch('http://local.app/api/admin/notices/save', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'x-admin-token': operator.session.token
  },
  body: JSON.stringify({
    gameKey: 'game_sample',
    title: 'operator notice',
    content: 'operator can edit notices',
    status: 'draft'
  })
});
const operatorNoticePayload = await operatorNoticeResponse.json();

if (!operatorNoticeResponse.ok || !operatorNoticePayload.success) {
  throw new Error(`Expected operator notice save to succeed: ${JSON.stringify(operatorNoticePayload)}`);
}

const auditResponse = await app.fetch('http://local.app/api/admin/audit-logs?gameKey=game_sample', {
  headers: {
    'x-admin-token': superAdmin.session.token
  }
});
const auditPayload = await auditResponse.json();

if (!auditResponse.ok || !auditPayload.success || auditPayload.data.total < 3) {
  throw new Error(`Expected admin audit logs: ${JSON.stringify(auditPayload)}`);
}

const auditActions = auditPayload.data.items.map((item) => `${item.adminUsername}:${item.action}`);
if (
  !auditActions.includes('operator:config.save_draft') ||
  !auditActions.includes('admin:config.publish') ||
  !auditActions.includes('operator:notice.create')
) {
  throw new Error(`Expected audit actions to be recorded: ${JSON.stringify(auditPayload.data.items)}`);
}

const logoutResponse = await app.fetch('http://local.app/api/admin/auth/logout', {
  method: 'POST',
  headers: {
    'x-admin-token': superAdmin.session.token
  }
});
const logoutPayload = await logoutResponse.json();

if (!logoutResponse.ok || !logoutPayload.success || logoutPayload.data.revoked !== true) {
  throw new Error(`Expected logout to revoke session: ${JSON.stringify(logoutPayload)}`);
}

const meAfterLogoutResponse = await app.fetch('http://local.app/api/admin/auth/me', {
  headers: {
    'x-admin-token': superAdmin.session.token
  }
});
const meAfterLogoutPayload = await meAfterLogoutResponse.json();

if (meAfterLogoutResponse.status !== 401 || meAfterLogoutResponse.ok || meAfterLogoutPayload.success || meAfterLogoutPayload.code !== 'UNAUTHORIZED') {
  throw new Error(`Expected revoked session to be rejected: ${JSON.stringify(meAfterLogoutPayload)}`);
}

console.log(
  JSON.stringify(
    {
      databaseFilePath,
      superAdminRole: superAdmin.adminUser.roleCode,
      operatorRole: operator.adminUser.roleCode,
      viewerRole: viewer.adminUser.roleCode,
      operatorPublishCode: operatorPublishPayload.code,
      viewerNoticeWriteCode: viewerNoticeWritePayload.code,
      auditActions
    },
    null,
    2
  )
);

app.close();
