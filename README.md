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
- `docs/05-data/*.md` 与 `sql/001_init_core_tables.sql` 仍保持 MySQL 8 作为目标生产模型
- 也就是说，当前代码上的 SQLite 是开发持久化适配层，不是对文档目标数据库的否定
