import { startServer } from '../services/api-server/dist/services/api-server/src/server.js';

const databaseFilePath = `/tmp/mini-game-workflow-http-${Date.now()}-${Math.random().toString(36).slice(2)}.sqlite`;
const server = await startServer({
  host: '127.0.0.1',
  port: 0,
  database: {
    filePath: databaseFilePath
  }
});

const healthResponse = await fetch(`${server.url}/health`);
const health = await healthResponse.json();

if (!healthResponse.ok || health.ok !== true) {
  throw new Error(`Unexpected health response: ${JSON.stringify({ status: healthResponse.status, health })}`);
}

const preflightResponse = await fetch(`${server.url}/api/config`, {
  method: 'OPTIONS'
});

if (preflightResponse.status !== 204 || preflightResponse.headers.get('access-control-allow-origin') !== '*') {
  throw new Error(
    `Unexpected preflight response: ${JSON.stringify({
      status: preflightResponse.status,
      allowOrigin: preflightResponse.headers.get('access-control-allow-origin')
    })}`
  );
}

const loginResponse = await fetch(`${server.url}/api/auth/login`, {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json'
  },
  body: JSON.stringify({
    gameKey: 'game_sample',
    platform: 'web',
    code: 'http-verify-login-code',
    clientVersion: '0.1.0'
  })
});

const loginPayload = await loginResponse.json();
const token = loginPayload.data?.token;

if (!loginResponse.ok || !loginPayload.success || typeof token !== 'string') {
  throw new Error(`Unexpected login payload: ${JSON.stringify(loginPayload)}`);
}

const configResponse = await fetch(
  `${server.url}/api/config?gameKey=game_sample&platform=web&clientVersion=0.1.0`
);
const configPayload = await configResponse.json();

if (!configResponse.ok || !configPayload.success || configPayload.data?.configVersion !== 'seed-web-v1') {
  throw new Error(`Unexpected config payload: ${JSON.stringify(configPayload)}`);
}

const saveGetResponse = await fetch(`${server.url}/api/save`, {
  headers: {
    Authorization: `Bearer ${token}`
  }
});
const saveGetPayload = await saveGetResponse.json();

if (!saveGetResponse.ok || !saveGetPayload.success || saveGetPayload.data?.save !== null) {
  throw new Error(`Unexpected save GET payload: ${JSON.stringify(saveGetPayload)}`);
}

const savePostResponse = await fetch(`${server.url}/api/save`, {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${token}`
  },
  body: JSON.stringify({
    save: {
      schemaVersion: 1,
      data: {
        coins: 19,
        level: 3
      }
    }
  })
});
const savePostPayload = await savePostResponse.json();

if (
  !savePostResponse.ok ||
  !savePostPayload.success ||
  savePostPayload.data?.save?.data?.coins !== 19 ||
  savePostPayload.data?.save?.data?.level !== 3
) {
  throw new Error(`Unexpected save POST payload: ${JSON.stringify(savePostPayload)}`);
}

const saveVerifyResponse = await fetch(`${server.url}/api/save`, {
  headers: {
    Authorization: `Bearer ${token}`
  }
});
const saveVerifyPayload = await saveVerifyResponse.json();

if (
  !saveVerifyResponse.ok ||
  !saveVerifyPayload.success ||
  saveVerifyPayload.data?.save?.data?.coins !== 19 ||
  saveVerifyPayload.data?.save?.data?.level !== 3
) {
  throw new Error(`Unexpected save verification payload: ${JSON.stringify(saveVerifyPayload)}`);
}

const adminUsersResponse = await fetch(`${server.url}/api/admin/users?gameKey=game_sample`, {
  headers: {
    'x-admin-token': 'dev-admin-token'
  }
});
const adminUsersPayload = await adminUsersResponse.json();

if (!adminUsersResponse.ok || !adminUsersPayload.success || adminUsersPayload.data?.items?.length !== 1) {
  throw new Error(`Unexpected admin users payload: ${JSON.stringify(adminUsersPayload)}`);
}

console.log(
  JSON.stringify(
    {
      url: server.url,
      databaseFilePath,
      health,
      configVersion: configPayload.data.configVersion,
      initialSaveWasNull: true,
      savedCoins: savePostPayload.data.save.data.coins,
      adminUsers: adminUsersPayload.data.items.length
    },
    null,
    2
  )
);

await server.close();
