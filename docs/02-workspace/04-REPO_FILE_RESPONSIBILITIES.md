# 仓库目录与文件职责

## 1. 目标

这份文档不是重复说明“有哪些目录”，而是明确：

- 第一版仓库具体应该长什么样
- 每个关键文件为什么存在
- 哪些文件是平台层，哪些文件是游戏层

目标是避免后续一开工就出现：

- 文件放错层
- 共享层和游戏层互相穿透
- 每个模块入口不统一

## 2. 推荐首版目录树

```text
mini-game-workflow/
├─ apps/
│  └─ game-sample/
│     ├─ client/
│     │  ├─ src/
│     │  │  ├─ main.ts
│     │  │  ├─ bootstrap.ts
│     │  │  ├─ game/
│     │  │  │  ├─ GameApp.ts
│     │  │  │  ├─ scenes/
│     │  │  │  └─ ui/
│     │  └─ package.json
│     ├─ game.config.ts
│     └─ README.md
├─ packages/
│  ├─ game-core-types/
│  │  └─ src/
│  │     ├─ game-config.ts
│  │     ├─ network.ts
│  │     ├─ save.ts
│  │     ├─ config.ts
│  │     ├─ analytics.ts
│  │     ├─ ad.ts
│  │     └─ api.ts
│  ├─ game-core-utils/
│  │  └─ src/
│  │     ├─ assert.ts
│  │     ├─ time.ts
│  │     └─ index.ts
│  ├─ game-core-config/
│  │  └─ src/
│  │     ├─ config-loader.ts
│  │     ├─ config-merge.ts
│  │     └─ index.ts
│  └─ game-core-client/
│     └─ src/
│        ├─ index.ts
│        ├─ platform/
│        │  ├─ PlatformAdapter.ts
│        │  ├─ WechatPlatformAdapter.ts
│        │  ├─ DouyinPlatformAdapter.ts
│        │  └─ WebMockPlatformAdapter.ts
│        ├─ network/
│        │  ├─ NetworkManager.ts
│        │  └─ createNetworkManager.ts
│        ├─ save/
│        │  ├─ SaveManager.ts
│        │  └─ createSaveManager.ts
│        ├─ config/
│        │  ├─ ConfigManager.ts
│        │  └─ createConfigManager.ts
│        ├─ analytics/
│        │  ├─ AnalyticsManager.ts
│        │  └─ createAnalyticsManager.ts
│        ├─ ad/
│        │  ├─ AdManager.ts
│        │  └─ createAdManager.ts
│        └─ bootstrap/
│           └─ createCoreRuntime.ts
├─ services/
│  ├─ api-server/
│  │  └─ src/
│  │     ├─ app.ts
│  │     ├─ server.ts
│  │     ├─ common/
│  │     │  ├─ response.ts
│  │     │  ├─ errors.ts
│  │     │  ├─ auth.ts
│  │     │  └─ game-key.ts
│  │     ├─ db/
│  │     │  ├─ connection.ts
│  │     │  ├─ schema/
│  │     │  └─ repositories/
│  │     ├─ modules/
│  │     │  ├─ auth/
│  │     │  ├─ config/
│  │     │  ├─ save/
│  │     │  ├─ notice/
│  │     │  ├─ ad/
│  │     │  ├─ reward/
│  │     │  └─ analytics/
│  │     └─ routes/
│  │        ├─ auth.ts
│  │        ├─ config.ts
│  │        ├─ save.ts
│  │        ├─ notice.ts
│  │        ├─ ad.ts
│  │        ├─ reward.ts
│  │        └─ analytics.ts
│  └─ admin-web/
│     └─ src/
│        ├─ main.tsx
│        ├─ app/
│        ├─ pages/
│        │  ├─ dashboard/
│        │  ├─ users/
│        │  ├─ configs/
│        │  ├─ notices/
│        │  ├─ ad-logs/
│        │  ├─ reward-logs/
│        │  └─ analytics/
│        ├─ components/
│        └─ services/
├─ sql/
│  ├─ 001_init_core_tables.sql
│  └─ README.md
└─ docs/
```

## 3. `apps/` 下的职责

### 3.1 `apps/game-sample/game.config.ts`

职责：

- 声明当前游戏的接入信息
- 提供 `gameKey`、`features`、命名空间、平台目标

它不负责：

- 业务运行参数
- 广告位 ID
- 活动开关

### 3.2 `apps/game-sample/client/src/main.ts`

职责：

- 当前游戏客户端的入口文件
- 调用 `bootstrap.ts`

它不负责：

- 定义平台通用能力
- 实现共享模块内部逻辑

### 3.3 `apps/game-sample/client/src/bootstrap.ts`

职责：

- 读取 `game.config.ts`
- 创建核心 runtime
- 将当前游戏玩法入口和平台核心拼起来

### 3.4 `apps/game-sample/client/src/game/`

职责：

- 只放当前游戏自己的玩法、场景、UI

这里不应出现：

- 平台适配实现
- 存档底层机制
- 广告底层机制

## 4. `packages/` 下的职责

### 4.1 `game-core-types`

职责：

- 放前后端共享的类型定义

建议首期包含：

- `GameConfig`
- `FeatureFlags`
- `NetworkRequestOptions`
- `SaveEnvelope`
- `ConfigEnvelope`
- `AnalyticsEventInput`
- `AdResult`
- 通用 API 响应结构

### 4.2 `game-core-utils`

职责：

- 放真正通用的纯工具

要求：

- 不依赖具体平台
- 不依赖具体游戏

### 4.3 `game-core-config`

职责：

- 管理配置加载和合并的纯逻辑

要求：

- 不直接依赖某个平台 API
- 不直接读取某个游戏业务字段

### 4.4 `game-core-client`

职责：

- 放客户端共享运行时能力

首期只应包含：

- `platform`
- `network`
- `save`
- `config`
- `analytics`
- `ad`
- `bootstrap`

不要过早放进：

- 任务
- 活动
- 品类玩法模板

## 5. `services/api-server` 下的职责

### 5.1 `src/common/`

职责：

- 放全局中间层能力

建议首期包含：

- 统一响应封装
- 错误码映射
- token 鉴权
- `gameKey` 提取与校验

### 5.2 `src/db/`

职责：

- 放数据库连接、schema、repository

要求：

- repository 层围绕当前已经确定的核心表展开
- 不在业务路由里直接写 SQL 字符串

### 5.3 `src/modules/`

职责：

- 放按业务能力划分的模块

首期必须有：

- `auth`
- `config`
- `save`
- `notice`
- `ad`
- `reward`
- `analytics`

### 5.4 `src/routes/`

职责：

- 只负责 HTTP 层入口映射

它不应承担：

- 核心业务逻辑
- repository 细节

## 6. `services/admin-web` 下的职责

### 6.1 `pages/`

职责：

- 放后台页面

首期页面：

- `dashboard`
- `users`
- `configs`
- `notices`
- `ad-logs`
- `reward-logs`
- `analytics`

### 6.2 `services/`

职责：

- 放后台调用服务端 API 的封装

要求：

- 页面不直接写请求 URL 和错误码判断细节

## 7. `sql/` 下的职责

建议：

- 每次核心表结构变更都形成单独 SQL 文件
- 首期把当前最小闭环的建表语句汇总到 `001_init_core_tables.sql`

## 8. 最重要的边界检查

如果后续某个文件不知道应该放哪，先问这三个问题：

1. 它是跨游戏复用，还是当前游戏专属？
2. 它是平台运行时能力，还是玩法业务逻辑？
3. 它是协议/类型定义，还是具体实现？

按这三个问题判断，通常能避免把文件放错层。
