# 小游戏工作流文档

这套文档的目标不是把平台一次写成“大而全”，而是先把未来最容易返工的内核边界定清楚。

当前首批文档只回答 4 个问题：

1. 这个项目到底要解决什么问题。
2. 平台哪些地方必须先设计到位。
3. monorepo 应该如何分层，哪些代码放哪里。
4. 后续新增模块或新增游戏时，如何尽量不回头修改旧游戏。

当前文档列表：

- `00-foundation/01-PROJECT_OVERVIEW.md`：项目目标、边界、阶段划分。
- `00-foundation/03-ARCHITECTURE_PRINCIPLES.md`：稳定内核优先的设计原则。
- `02-workspace/00-WORKSPACE_LAYOUT.md`：仓库目录结构与分层边界。
- `02-workspace/01-MULTI_GAME_EVOLUTION_STRATEGY.md`：多游戏扩展、兼容与回改控制策略。
- `02-workspace/02-GAME_CONFIG_SPEC.md`：每个游戏的接入配置规范。
- `02-workspace/03-FEATURE_MODULE_REGISTRATION.md`：可选模块注册与启用机制。
- `03-client/04-NETWORK_MANAGER_SPEC.md`：客户端统一请求入口、鉴权注入与响应解析规则。
- `03-client/05-SAVE_MANAGER_SPEC.md`：存档 schema、迁移与持久化边界。
- `03-client/06-CONFIG_MANAGER_SPEC.md`：配置来源、版本、合并与读取规则。
- `03-client/07-ANALYTICS_MANAGER_SPEC.md`：埋点采集、上报与失败处理规则。
- `03-client/03-PLATFORM_ADAPTER_SPEC.md`：平台适配层职责边界与接口规范。
- `03-client/08-AD_MANAGER_SPEC.md`：广告模块职责、平台能力边界与奖励解耦规则。
- `04-server/00-SERVER_EXTENSION_STRATEGY.md`：共用服务端按 `gameKey` 扩展的策略。
- `04-server/02-AUTH_AND_IDENTITY_SPEC.md`：登录流程、token 结构和用户身份模型。
- `04-server/03-ANALYTICS_API_SPEC.md`：埋点接收协议、落表与鉴权规则。
- `04-server/04-SAVE_API_SPEC.md`：云存档读写协议与版本约束。
- `04-server/05-CONFIG_API_SPEC.md`：配置拉取协议、版本规则与兼容策略。
- `04-server/06-AD_VERIFY_AND_REWARD_API_SPEC.md`：广告校验、奖励发放与幂等约束。
- `04-server/01-API_RESPONSE_AND_ERROR_SPEC.md`：统一响应结构、错误码与接口约束。
- `05-data/01-DATABASE_SCHEMA.md`：核心数据表、唯一键、索引与隔离规则。
- `05-data/02-SQL_DRAFT.md`：首期核心表 SQL 草案。
- `06-admin/00-ADMIN_SCOPE_AND_MENU.md`：后台范围、菜单结构与隔离规则。
- `06-admin/01-ADMIN_CORE_PAGES_SPEC.md`：配置管理、用户查询、日志与公告页面规范。
- `07-dev-process/00-IMPLEMENTATION_ROADMAP.md`：从文档到代码的实施顺序与阶段目标。
- `02-workspace/04-REPO_FILE_RESPONSIBILITIES.md`：仓库首版目录树与关键文件职责。
- `07-dev-process/01-FIRST_CODE_SKELETON.md`：第一版代码骨架与最小文件清单。

当前原则：

- 先定稳定内核，再逐步补模块。
- 先避免未来大面积返工，再谈快速产出。
- 共享层绝不承载具体游戏玩法。
- 旧游戏必须可以长期运行，新增能力应优先通过增量方式接入。
