# mini-game-workflow

一个面向多款小游戏复用的 monorepo 工作流仓库。

当前仓库包含两部分内容：

- `docs/`：平台架构、协议、数据模型与实施路线文档
- 首批代码骨架：`apps/`、`packages/`、`services/`、`sql/`

当前阶段目标：

- 保持共享层边界稳定
- 先跑通登录、配置、存档的最小链路
- 为后续广告、奖励、埋点、后台接入保留稳定扩展位

当前实现说明：

- `services/api-server` 已从纯内存仓储切到基于 `node:sqlite` 的本地文件持久化，用于开发期真实落盘和联调验证
- `services/api-server` 现在包含后台管理员账号、角色、会话与审计日志模型，后台不再依赖固定开发 token
- `services/api-server` 现在已经有独立的 Node HTTP 入口，可以通过构建后执行 `node services/api-server/dist/services/api-server/src/cli.js` 启动
- 根目录现在提供统一的本地 dev stack 入口：先执行 `npm run build`，再执行 `npm run dev:stack`，然后打开 `http://127.0.0.1:3100`
- 这个入口页会同时暴露：
  - 后台壳：`/admin.html`
  - 样例客户端：`/game-sample.html`
  - API 健康检查：`http://127.0.0.1:3000/health`
- `docs/05-data/*.md` 与 `sql/001_init_core_tables.sql` 仍保持 MySQL 8 作为目标生产模型
- 也就是说，当前代码上的 SQLite 是开发持久化适配层，不是对文档目标数据库的否定

本地开发默认管理员账号：

- `admin / dev-admin-password`
- `operator / dev-operator-password`
- `viewer / dev-viewer-password`

最小本地启动步骤：

1. `npm install`
2. `npm run build`
3. `npm run dev:stack`
4. 打开 `http://127.0.0.1:3100`

可直接访问的页面：

- 门户：`http://127.0.0.1:3100`
- 后台：`http://127.0.0.1:3100/admin.html`
- 样例客户端：`http://127.0.0.1:3100/game-sample.html`
- 健康检查：`http://127.0.0.1:3000/health`

说明：

- `health` 只是健康检查接口，不是接口列表页
- 它当前只返回最小 JSON 状态，例如 `ok`、服务名和数据库文件路径
- 如果你打开后只看到一段 JSON，这是当前设计的正常行为

部署说明：

- 当前仓库已经补了面向 `services/api-server` 的 Dockerfile 和 GitHub Actions 自动部署工作流：
  - [Dockerfile](/Users/baiyexing/myProject/mini-game-workflow/Dockerfile)
  - [.github/workflows/deploy-api-server.yml](/Users/baiyexing/myProject/mini-game-workflow/.github/workflows/deploy-api-server.yml)
- 现阶段建议的小游戏业务域名是：`https://api-mini.zhitaie.com`
- 建议在 Nginx Proxy Manager 中将该域名转发到宿主机 `3003`
- 线上部署建议使用：
  - `API_HOST=0.0.0.0`
  - `API_PORT=3003`
  - `API_DB_FILE=/data/mini-game-workflow.sqlite`
- 生产环境不能继续使用开发管理员默认密码；部署工作流会要求额外提供：
  - `MINI_GAME_WORKFLOW_ADMIN_BOOTSTRAP_PASSWORD`
- 环境变量模板见：
  - [.env.example](/Users/baiyexing/myProject/mini-game-workflow/.env.example)
  - [.env.local.example](/Users/baiyexing/myProject/mini-game-workflow/.env.local.example)
  - [.env.production.example](/Users/baiyexing/myProject/mini-game-workflow/.env.production.example)
