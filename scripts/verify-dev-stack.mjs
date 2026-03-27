import { startDevStack } from './dev-stack-lib.mjs';

const databaseFilePath = `/tmp/mini-game-workflow-dev-stack-${Date.now()}-${Math.random().toString(36).slice(2)}.sqlite`;
const stack = await startDevStack({
  host: '127.0.0.1',
  apiPort: 0,
  shellPort: 0,
  databaseFilePath
});

async function expectJson(url) {
  const response = await fetch(url);
  const payload = await response.json();

  if (!response.ok) {
    throw new Error(`Unexpected response for ${url}: ${JSON.stringify({ status: response.status, payload })}`);
  }

  return payload;
}

async function expectText(url) {
  const response = await fetch(url);
  const text = await response.text();

  if (!response.ok) {
    throw new Error(`Unexpected response for ${url}: ${JSON.stringify({ status: response.status, text })}`);
  }

  return {
    text,
    contentType: response.headers.get('content-type')
  };
}

try {
  const shellHealth = await expectJson(`${stack.shellURL}/health`);
  const apiHealth = await expectJson(`${stack.apiURL}/health`);
  const portalPage = await expectText(`${stack.shellURL}/`);
  const adminPage = await expectText(`${stack.shellURL}/admin.html`);
  const samplePage = await expectText(`${stack.shellURL}/game-sample.html`);
  const adminBrowserAsset = await expectText(`${stack.shellURL}/dist/services/admin-web/src/browser.js`);
  const adminMainAsset = await expectText(`${stack.shellURL}/dist/services/admin-web/src/main.js`);
  const sampleBrowserAsset = await expectText(`${stack.shellURL}/dist/apps/game-sample/client/src/browser.js`);
  const sampleBootstrapAsset = await expectText(`${stack.shellURL}/dist/apps/game-sample/client/src/bootstrap.js`);
  const sampleGameConfigAsset = await expectText(`${stack.shellURL}/dist/apps/game-sample/game.config.js`);
  const sampleCoreClientAsset = await expectText(
    `${stack.shellURL}/dist/apps/game-sample/client/packages/game-core-client/src/index.js`
  );
  const sampleCoreTypesAsset = await expectText(
    `${stack.shellURL}/dist/apps/game-sample/client/packages/game-core-types/src/index.js`
  );

  if (shellHealth.ok !== true || shellHealth.apiURL !== stack.apiURL || shellHealth.shellURL !== stack.shellURL) {
    throw new Error(`Unexpected shell health payload: ${JSON.stringify(shellHealth)}`);
  }

  if (apiHealth.ok !== true || typeof apiHealth.databaseFilePath !== 'string') {
    throw new Error(`Unexpected api health payload: ${JSON.stringify(apiHealth)}`);
  }

  if (!portalPage.text.includes('Mini Game Workflow Dev Stack') || !portalPage.text.includes('/admin.html')) {
    throw new Error(`Unexpected portal html: ${portalPage.text}`);
  }

  if (
    !adminPage.text.includes(`baseURL: ${JSON.stringify(stack.apiURL)}`) ||
    !adminPage.text.includes("/dist/services/admin-web/src/browser.js")
  ) {
    throw new Error(`Unexpected admin html: ${adminPage.text}`);
  }

  if (
    !samplePage.text.includes(`baseURL: ${JSON.stringify(stack.apiURL)}`) ||
    !samplePage.text.includes('/dist/apps/game-sample/client/src/browser.js') ||
    !samplePage.text.includes('/dist/apps/game-sample/client/packages/game-core-client/src/index.js') ||
    !samplePage.text.includes('/dist/apps/game-sample/client/packages/game-core-types/src/index.js')
  ) {
    throw new Error(`Unexpected game sample html: ${samplePage.text}`);
  }

  if (!adminBrowserAsset.text.includes('startAdminBrowserApp') || !adminMainAsset.text.includes('bootstrapAndRenderAdminApp')) {
    throw new Error('Admin static assets were not served as expected.');
  }

  if (
    !sampleBrowserAsset.text.includes('bootstrapGameSample') ||
    !sampleBootstrapAsset.text.includes('@mini-game-workflow/game-core-client') ||
    !sampleGameConfigAsset.text.includes("gameKey: 'game_sample'")
  ) {
    throw new Error('Game sample static assets were not served as expected.');
  }

  if (
    !sampleCoreClientAsset.text.includes('createCoreRuntime') ||
    !sampleCoreTypesAsset.text.includes("./save.js")
  ) {
    throw new Error('Game sample package assets were not served as expected.');
  }

  const loginResponse = await fetch(`${stack.apiURL}/api/auth/login`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      gameKey: 'game_sample',
      platform: 'web',
      code: 'dev-stack-login',
      clientVersion: '0.1.0'
    })
  });
  const loginPayload = await loginResponse.json();

  if (!loginResponse.ok || !loginPayload.success || typeof loginPayload.data?.token !== 'string') {
    throw new Error(`Unexpected login payload from dev stack api: ${JSON.stringify(loginPayload)}`);
  }

  console.log(
    JSON.stringify(
      {
        shellURL: stack.shellURL,
        apiURL: stack.apiURL,
        databaseFilePath,
        shellHealth,
        portalHasAdminLink: portalPage.text.includes('/admin.html'),
        adminAssetContentType: adminBrowserAsset.contentType,
        sampleAssetContentType: sampleBrowserAsset.contentType,
        loginUserId: loginPayload.data.user.id
      },
      null,
      2
    )
  );
} finally {
  await stack.close();
}
