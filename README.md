# mini-game-workflow

一个面向多款小游戏复用的 TypeScript monorepo：共享游戏协议与客户端能力、可替换的 API 服务、管理端壳，以及基于 Cocos Creator 的滑雪样例游戏。

> 当前为 `0.1.0` 早期可运行版本。它适合学习、二次开发和验证架构边界；生产发布前仍应完成自己的安全、数据备份、合规与平台审核。

## 包含什么

- `packages/`：不包含具体玩法的共享类型、配置、存档、网络与奖励能力。
- `services/api-server`：本地 SQLite 开发服务，包含配置、存档、奖励、管理端鉴权与审计模型。
- `services/admin-web`：单人开发者可用的管理端壳。
- `apps/game-sample`：浏览器样例客户端，用于联调共享能力。
- `apps/ski-endless/client`：Cocos Creator 3.8.8 滑雪样例，包含微信小游戏平台适配入口。
- `docs/`、`sql/`：架构约束、协议和面向 MySQL 8 的目标生产数据模型。

## 快速开始

前置条件：Node.js 22、npm，以及 Cocos 样例开发所需的 Cocos Creator 3.8.8。

```bash
npm install
npm run setup:ski-local-config
npm run build
npm run dev:stack
```

本地入口：

- 门户：`http://127.0.0.1:3100`
- 管理端：`http://127.0.0.1:3100/admin.html`
- 浏览器样例：`http://127.0.0.1:3100/game-sample.html`
- API 健康检查：`http://127.0.0.1:3000/health`

本地开发管理员账号仅用于开发环境：`admin / dev-admin-password`。

## Cocos 样例

`apps/ski-endless/client` 是独立的 Cocos 项目，Cocos Creator 会生成 `temp/`、`library/` 等本机文件；这些文件不会提交，也不属于可复现的 Node.js 构建。

1. 用 Cocos Creator 3.8.8 打开 `apps/ski-endless/client`。
2. 在编辑器中预览或构建小游戏。
3. 需要命令行额外校验时，先让编辑器完成导入，再执行：

```bash
npm run build:with-cocos
```

`npm run setup:ski-local-config` 会在缺失时从公开示例生成本机配置文件。请在生成的 `SkiEndlessPlatformConfig.local.ts` 中填写自己的 API 地址和广告位；它已被 Git 忽略，不能提交真实 AppID、域名或广告位 ID。

## 验证

```bash
npm run build
npm run verify:minimal
npm run verify:dev-stack
npm run verify:persistence
```

公开 CI 会执行上述可复现验证。Cocos 校验由本地 Cocos Creator 环境完成，因为其生成的引擎声明不应进入仓库。

## 部署

API 服务支持 Docker 部署。生产配置应只保存在部署环境或 GitHub Actions 的 Variables / Secrets 中，不能提交到仓库。参考：

- [Dockerfile](Dockerfile)
- [环境变量示例](.env.production.example)
- [部署工作流](.github/workflows/deploy-api-server.yml)

部署工作流只会在所需的仓库 Variables 都配置后执行；未配置的 fork 或公开克隆不会因此导致验证失败。

## 参与和安全

- 贡献方式见 [CONTRIBUTING.md](CONTRIBUTING.md)。
- 安全问题见 [SECURITY.md](SECURITY.md)，请勿公开泄露漏洞或密钥。
- 社区行为规范见 [CODE_OF_CONDUCT.md](CODE_OF_CONDUCT.md)。
- 变更记录见 [CHANGELOG.md](CHANGELOG.md)。

## License

本项目采用 [Apache License 2.0](LICENSE)。
