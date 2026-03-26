import { access, readFile } from 'node:fs/promises';
import { createServer } from 'node:http';
import { resolve, extname, relative, isAbsolute } from 'node:path';
import { fileURLToPath } from 'node:url';
import { startServer as startApiServer } from '../services/api-server/dist/services/api-server/src/server.js';

const ROOT_DIR = fileURLToPath(new URL('../', import.meta.url));
const DEFAULT_HOST = '127.0.0.1';
const DEFAULT_API_PORT = 3000;
const DEFAULT_SHELL_PORT = 3100;
const STATIC_MOUNTS = [
  {
    urlPrefix: '/dist/apps/game-sample/client/packages/',
    directory: resolve(ROOT_DIR, 'apps/game-sample/client/dist/packages')
  },
  {
    urlPrefix: '/dist/apps/game-sample/client/',
    directory: resolve(ROOT_DIR, 'apps/game-sample/client/dist/apps/game-sample/client')
  },
  {
    urlPrefix: '/dist/services/admin-web/packages/',
    directory: resolve(ROOT_DIR, 'services/admin-web/dist/packages')
  },
  {
    urlPrefix: '/dist/services/admin-web/',
    directory: resolve(ROOT_DIR, 'services/admin-web/dist/services/admin-web')
  }
];

function escapeHtml(value) {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function contentTypeFor(pathname) {
  switch (extname(pathname)) {
    case '.html':
      return 'text/html; charset=utf-8';
    case '.js':
      return 'application/javascript; charset=utf-8';
    case '.css':
      return 'text/css; charset=utf-8';
    case '.json':
      return 'application/json; charset=utf-8';
    case '.svg':
      return 'image/svg+xml';
    default:
      return 'text/plain; charset=utf-8';
  }
}

function createPortalHtml({ apiURL, shellURL }) {
  return `<!DOCTYPE html>
<html lang="zh-CN">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>Mini Game Workflow Dev Stack</title>
    <style>
      :root {
        --dev-bg: #f5efe3;
        --dev-surface: rgba(255, 252, 247, 0.94);
        --dev-ink: #1f2726;
        --dev-muted: #68716d;
        --dev-accent: #0d6b57;
        --dev-line: rgba(31, 39, 38, 0.1);
        --dev-shadow: 0 24px 64px rgba(34, 41, 34, 0.12);
        --dev-font: "IBM Plex Sans", "Avenir Next", "Segoe UI", sans-serif;
      }

      * { box-sizing: border-box; }

      body {
        margin: 0;
        font-family: var(--dev-font);
        color: var(--dev-ink);
        background:
          radial-gradient(circle at top left, rgba(71, 145, 117, 0.2), transparent 30%),
          linear-gradient(180deg, #fbf6ed 0%, #ece4d8 100%);
      }

      .dev-shell {
        min-height: 100vh;
        padding: 24px;
      }

      .dev-stage {
        max-width: 1080px;
        margin: 0 auto;
        display: grid;
        gap: 20px;
      }

      .dev-hero,
      .dev-card {
        border: 1px solid var(--dev-line);
        border-radius: 24px;
        background: var(--dev-surface);
        box-shadow: var(--dev-shadow);
        backdrop-filter: blur(8px);
      }

      .dev-hero {
        padding: 28px;
      }

      .dev-hero h1 {
        margin: 0;
        font-size: 34px;
      }

      .dev-hero p {
        margin: 10px 0 0;
        line-height: 1.65;
        color: var(--dev-muted);
        max-width: 760px;
      }

      .dev-meta {
        margin-top: 18px;
        display: flex;
        flex-wrap: wrap;
        gap: 10px;
      }

      .dev-chip {
        display: inline-flex;
        gap: 8px;
        align-items: center;
        padding: 10px 14px;
        border-radius: 999px;
        background: rgba(255, 255, 255, 0.75);
        border: 1px solid var(--dev-line);
        font-size: 13px;
      }

      .dev-grid {
        display: grid;
        grid-template-columns: repeat(auto-fit, minmax(260px, 1fr));
        gap: 18px;
      }

      .dev-card {
        padding: 20px;
      }

      .dev-card h2 {
        margin: 0;
        font-size: 22px;
      }

      .dev-card p {
        margin: 8px 0 0;
        color: var(--dev-muted);
        line-height: 1.6;
      }

      .dev-link {
        margin-top: 18px;
        display: inline-flex;
        align-items: center;
        justify-content: center;
        border-radius: 999px;
        padding: 10px 16px;
        background: var(--dev-accent);
        color: #f6fffb;
        text-decoration: none;
        font-weight: 700;
      }
    </style>
  </head>
  <body>
    <div class="dev-shell">
      <div class="dev-stage">
        <section class="dev-hero">
          <h1>Mini Game Workflow Dev Stack</h1>
          <p>这个入口页把本地 API、后台和样例客户端统一到固定地址，方便直接打开浏览器联调，不再依赖单独的脚本验证。</p>
          <div class="dev-meta">
            <div class="dev-chip"><span>API</span><strong>${escapeHtml(apiURL)}</strong></div>
            <div class="dev-chip"><span>Shell</span><strong>${escapeHtml(shellURL)}</strong></div>
            <div class="dev-chip"><span>Admin</span><strong>admin / dev-admin-password</strong></div>
          </div>
        </section>

        <section class="dev-grid">
          <article class="dev-card">
            <h2>Admin Web</h2>
            <p>打开后台管理壳，直接连接真实 api-server。</p>
            <a class="dev-link" href="/admin.html">打开后台</a>
          </article>

          <article class="dev-card">
            <h2>Game Sample</h2>
            <p>打开样例客户端联调页，验证登录、配置、存档和奖励广告链路。</p>
            <a class="dev-link" href="/game-sample.html">打开样例客户端</a>
          </article>

          <article class="dev-card">
            <h2>Health</h2>
            <p>直接查看 api-server 健康检查结果。</p>
            <a class="dev-link" href="${escapeHtml(`${apiURL}/health`)}">打开健康检查</a>
          </article>
        </section>
      </div>
    </div>
  </body>
</html>`;
}

function createAdminHtml(apiURL) {
  return `<!DOCTYPE html>
<html lang="zh-CN">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>Mini Game Workflow Admin</title>
  </head>
  <body>
    <div id="app"></div>
    <script>
      window.__MINI_GAME_ADMIN__ = {
        baseURL: ${JSON.stringify(apiURL)},
        adminUsername: 'admin',
        adminPassword: 'dev-admin-password',
        gameKey: 'game_sample',
        containerSelector: '#app'
      };
    </script>
    <script type="module">
      import { startAdminBrowserApp } from '/dist/services/admin-web/src/browser.js';

      startAdminBrowserApp();
    </script>
  </body>
</html>`;
}

function createGameSampleHtml(apiURL) {
  const importMap = {
    imports: {
      '@mini-game-workflow/game-core-client': '/dist/apps/game-sample/client/packages/game-core-client/src/index.js',
      '@mini-game-workflow/game-core-types': '/dist/apps/game-sample/client/packages/game-core-types/src/index.js'
    }
  };

  return `<!DOCTYPE html>
<html lang="zh-CN">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>Game Sample Browser</title>
  </head>
  <body>
    <div id="app"></div>
    <script>
      window.__MINI_GAME_SAMPLE__ = {
        baseURL: ${JSON.stringify(apiURL)},
        containerSelector: '#app'
      };
    </script>
    <script type="importmap">${JSON.stringify(importMap, null, 2)}</script>
    <script type="module">
      import { startGameSampleBrowserApp } from '/dist/apps/game-sample/client/src/browser.js';

      startGameSampleBrowserApp();
    </script>
  </body>
</html>`;
}

async function ensureBuildArtifacts() {
  const requiredFiles = [
    resolve(ROOT_DIR, 'services/api-server/dist/services/api-server/src/server.js'),
    resolve(ROOT_DIR, 'services/admin-web/dist/services/admin-web/src/browser.js'),
    resolve(ROOT_DIR, 'apps/game-sample/client/dist/apps/game-sample/client/src/browser.js'),
    resolve(ROOT_DIR, 'apps/game-sample/client/dist/packages/game-core-client/src/index.js'),
    resolve(ROOT_DIR, 'apps/game-sample/client/dist/packages/game-core-types/src/index.js')
  ];

  await Promise.all(
    requiredFiles.map(async (filePath) => {
      try {
        await access(filePath);
      } catch {
        throw new Error(`Missing build artifact: ${filePath}`);
      }
    })
  );
}

function resolveStaticFilePath(pathname) {
  for (const mount of STATIC_MOUNTS) {
    if (!pathname.startsWith(mount.urlPrefix)) {
      continue;
    }

    const relativePath = decodeURIComponent(pathname.slice(mount.urlPrefix.length));
    const filePath = resolve(mount.directory, relativePath);
    const relativeToMount = relative(mount.directory, filePath);

    if (relativeToMount.startsWith('..') || isAbsolute(relativeToMount)) {
      return {
        status: 'forbidden'
      };
    }

    return {
      status: 'ok',
      filePath
    };
  }

  return {
    status: 'missing'
  };
}

function createStaticShellServer({ host, port, apiURL }) {
  const server = createServer(async (request, response) => {
    const shellOrigin = `http://${host}:${server.address()?.port ?? port}`;
    const url = new URL(request.url ?? '/', shellOrigin);

    if (url.pathname === '/health') {
      response.writeHead(200, {
        'Content-Type': 'application/json'
      });
      response.end(
        JSON.stringify({
          ok: true,
          shellURL: shellOrigin,
          apiURL
        })
      );
      return;
    }

    if (url.pathname === '/') {
      response.writeHead(200, {
        'Content-Type': 'text/html; charset=utf-8'
      });
      response.end(createPortalHtml({ apiURL, shellURL: shellOrigin }));
      return;
    }

    if (url.pathname === '/admin.html') {
      response.writeHead(200, {
        'Content-Type': 'text/html; charset=utf-8'
      });
      response.end(createAdminHtml(apiURL));
      return;
    }

    if (url.pathname === '/game-sample.html') {
      response.writeHead(200, {
        'Content-Type': 'text/html; charset=utf-8'
      });
      response.end(createGameSampleHtml(apiURL));
      return;
    }

    if (!url.pathname.startsWith('/dist/')) {
      response.writeHead(404, {
        'Content-Type': 'application/json; charset=utf-8'
      });
      response.end(
        JSON.stringify({
          success: false,
          code: 'NOT_FOUND',
          message: `Unsupported dev shell path: ${url.pathname}`,
          data: null
        })
      );
      return;
    }

    const resolved = resolveStaticFilePath(url.pathname);

    if (resolved.status === 'forbidden') {
      response.writeHead(403, {
        'Content-Type': 'application/json; charset=utf-8'
      });
      response.end(
        JSON.stringify({
          success: false,
          code: 'FORBIDDEN',
          message: 'forbidden static path',
          data: null
        })
      );
      return;
    }

    if (resolved.status === 'missing') {
      response.writeHead(404, {
        'Content-Type': 'application/json; charset=utf-8'
      });
      response.end(
        JSON.stringify({
          success: false,
          code: 'STATIC_PREFIX_NOT_FOUND',
          message: `Unsupported static prefix: ${url.pathname}`,
          data: null
        })
      );
      return;
    }

    try {
      const content = await readFile(resolved.filePath);
      response.writeHead(200, {
        'Content-Type': contentTypeFor(resolved.filePath)
      });
      response.end(content);
    } catch {
      response.writeHead(404, {
        'Content-Type': 'application/json; charset=utf-8'
      });
      response.end(
        JSON.stringify({
          success: false,
          code: 'STATIC_NOT_FOUND',
          message: `Missing static asset: ${url.pathname}`,
          data: null
        })
      );
    }
  });

  return new Promise((resolvePromise, rejectPromise) => {
    server.once('error', rejectPromise);
    server.listen(port, host, () => {
      server.off('error', rejectPromise);
      resolvePromise({
        server,
        port: server.address()?.port ?? port,
        url: `http://${host}:${server.address()?.port ?? port}`
      });
    });
  });
}

export async function startDevStack(options = {}) {
  await ensureBuildArtifacts();

  const host = options.host ?? DEFAULT_HOST;
  const apiServer = await startApiServer({
    host,
    port: options.apiPort ?? DEFAULT_API_PORT,
    database: {
      filePath: options.databaseFilePath
    }
  });
  const staticServer = await createStaticShellServer({
    host,
    port: options.shellPort ?? DEFAULT_SHELL_PORT,
    apiURL: apiServer.url
  });

  return {
    apiURL: apiServer.url,
    shellURL: staticServer.url,
    databaseFilePath: apiServer.databaseFilePath,
    async close() {
      await new Promise((resolvePromise, rejectPromise) => {
        staticServer.server.close((error) => {
          if (error) {
            rejectPromise(error);
            return;
          }

          resolvePromise();
        });
      });
      await apiServer.close();
    }
  };
}
