# 第一版代码骨架

## 1. 目标

这份文档回答的是：

- 如果现在开始建仓库，第一批应该先创建哪些文件
- 每个文件先写成什么程度
- 哪些文件先放空实现，哪些文件必须一次写对边界

重点不是一开始就写很多代码，而是先把骨架搭对。

## 2. 第一批必须创建的文件

## 2.1 根目录

建议先创建：

```text
package.json
pnpm-workspace.yaml
tsconfig.base.json
.gitignore
```

职责：

- 定义 monorepo workspace
- 提供 TypeScript 基础配置
- 固定包管理与构建入口

## 2.2 `apps/game-sample/`

第一批建议创建：

```text
apps/game-sample/
├─ game.config.ts
├─ README.md
└─ client/
   ├─ package.json
   └─ src/
      ├─ main.ts
      ├─ bootstrap.ts
      └─ game/
         ├─ GameApp.ts
         └─ scenes/
```

每个文件的职责：

- `game.config.ts`
  当前游戏接入声明
- `main.ts`
  客户端入口
- `bootstrap.ts`
  组装共享 runtime 和当前游戏
- `GameApp.ts`
  当前游戏自己的总入口

## 2.3 `packages/game-core-types/`

第一批建议创建：

```text
packages/game-core-types/src/
├─ index.ts
├─ game-config.ts
├─ network.ts
├─ save.ts
├─ config.ts
├─ analytics.ts
├─ ad.ts
└─ api.ts
```

建议先定义这些类型：

- `GameConfig`
- `FeatureFlags`
- `NetworkRequestOptions`
- `SaveEnvelope`
- `SaveDefinition`
- `ConfigEnvelope`
- `AnalyticsEventInput`
- `AdResult`
- `ApiResponse`

这些类型应该优先稳定，因为后面很多模块都会依赖它们。

## 2.4 `packages/game-core-client/`

第一批建议创建：

```text
packages/game-core-client/src/
├─ index.ts
├─ bootstrap/
│  └─ createCoreRuntime.ts
├─ platform/
│  ├─ PlatformAdapter.ts
│  ├─ WechatPlatformAdapter.ts
│  ├─ DouyinPlatformAdapter.ts
│  └─ WebMockPlatformAdapter.ts
├─ network/
│  ├─ NetworkManager.ts
│  └─ createNetworkManager.ts
├─ save/
│  ├─ SaveManager.ts
│  └─ createSaveManager.ts
├─ config/
│  ├─ ConfigManager.ts
│  └─ createConfigManager.ts
├─ analytics/
│  ├─ AnalyticsManager.ts
│  └─ createAnalyticsManager.ts
└─ ad/
   ├─ AdManager.ts
   └─ createAdManager.ts
```

文件职责：

- `PlatformAdapter.ts`
  只定义接口，不写平台业务逻辑
- `WechatPlatformAdapter.ts`
  只写微信适配实现
- `WebMockPlatformAdapter.ts`
  用于本地开发和联调
- `NetworkManager.ts`
  定义统一请求入口和错误解析
- `createNetworkManager.ts`
  实现 HTTP 请求与鉴权注入
- `SaveManager.ts`
  定义存档管理接口
- `createSaveManager.ts`
  实现实例工厂
- `ConfigManager.ts`
  定义配置管理接口
- `createConfigManager.ts`
  实现实例工厂
- `AnalyticsManager.ts`
  定义埋点采集与上报接口
- `createAnalyticsManager.ts`
  实现事件队列与上报逻辑
- `AdManager.ts`
  定义广告展示接口与结果
- `createAdManager.ts`
  实现广告层运行时逻辑
- `createCoreRuntime.ts`
  把平台、网络、配置、存档、埋点、广告拼成统一运行时

## 2.5 `services/api-server/`

第一批建议创建：

```text
services/api-server/src/
├─ app.ts
├─ server.ts
├─ common/
│  ├─ response.ts
│  ├─ errors.ts
│  ├─ auth.ts
│  └─ game-key.ts
├─ db/
│  ├─ connection.ts
│  └─ repositories/
│     ├─ game-user.repository.ts
│     ├─ user-save.repository.ts
│     ├─ game-config.repository.ts
│     ├─ notice.repository.ts
│     ├─ ad-log.repository.ts
│     ├─ reward-log.repository.ts
│     ├─ user-asset-balance.repository.ts
│     └─ analytics-event.repository.ts
├─ modules/
│  ├─ auth/
│  │  ├─ auth.service.ts
│  │  └─ auth.controller.ts
│  ├─ config/
│  │  ├─ config.service.ts
│  │  └─ config.controller.ts
│  ├─ save/
│  │  ├─ save.service.ts
│  │  └─ save.controller.ts
│  ├─ notice/
│  │  ├─ notice.service.ts
│  │  └─ notice.controller.ts
│  ├─ ad/
│  │  ├─ ad.service.ts
│  │  └─ ad.controller.ts
│  ├─ reward/
│  │  ├─ reward.service.ts
│  │  └─ reward.controller.ts
│  └─ analytics/
│     ├─ analytics.service.ts
│     └─ analytics.controller.ts
└─ routes/
   ├─ index.ts
   ├─ auth.ts
   ├─ config.ts
   ├─ save.ts
   ├─ notice.ts
   ├─ ad.ts
   ├─ reward.ts
   └─ analytics.ts
```

最先必须写稳的文件：

- `common/response.ts`
- `common/errors.ts`
- `common/auth.ts`
- `common/game-key.ts`
- `modules/auth/auth.service.ts`
- `modules/config/config.service.ts`
- `modules/save/save.service.ts`
- `modules/reward/reward.service.ts`
- `modules/analytics/analytics.service.ts`

## 2.6 `services/admin-web/`

第一批建议创建：

```text
services/admin-web/src/
├─ main.tsx
├─ app/
│  └─ router.tsx
├─ services/
│  ├─ api-client.ts
│  ├─ dashboard.ts
│  ├─ users.ts
│  ├─ configs.ts
│  ├─ notices.ts
│  ├─ ad-logs.ts
│  ├─ reward-logs.ts
│  └─ analytics.ts
└─ pages/
   ├─ dashboard/
   ├─ users/
   ├─ configs/
   ├─ notices/
   ├─ ad-logs/
   ├─ reward-logs/
   └─ analytics/
```

注意：

- 后台先做服务层封装，再做页面
- 页面不要直接散写请求逻辑

## 3. 第一版最小实现要求

不是所有文件都要一次写满。

建议分三类：

### 3.1 先定义接口

- `game-core-types/*`
- `PlatformAdapter.ts`
- `NetworkManager.ts`
- `SaveManager.ts`
- `ConfigManager.ts`
- `AnalyticsManager.ts`
- `AdManager.ts`

### 3.2 先写最小实现

- `WebMockPlatformAdapter.ts`
- `createNetworkManager.ts`
- `createSaveManager.ts`
- `createConfigManager.ts`
- `createAnalyticsManager.ts`
- `auth.service.ts`
- `config.service.ts`
- `save.service.ts`
- `analytics.service.ts`

### 3.3 先放空骨架

- `DouyinPlatformAdapter.ts`
- `notices.ts`
- `dashboard` 页面
- `reward-logs` 页面
- `analytics` 页面高级筛选
- 部分后台高级筛选

只要接口和位置先定住，空骨架是可以接受的。

## 4. 第一批必须跑通的文件链路

建议先跑通下面这组文件之间的最小链路：

1. `apps/game-sample/game.config.ts`
2. `apps/game-sample/client/src/bootstrap.ts`
3. `packages/game-core-client/src/bootstrap/createCoreRuntime.ts`
4. `packages/game-core-client/src/platform/WebMockPlatformAdapter.ts`
5. `packages/game-core-client/src/network/createNetworkManager.ts`
6. `packages/game-core-client/src/config/createConfigManager.ts`
7. `packages/game-core-client/src/save/createSaveManager.ts`
8. `services/api-server/src/modules/auth/auth.service.ts`
9. `services/api-server/src/modules/config/config.service.ts`
10. `services/api-server/src/modules/save/save.service.ts`

这条链路跑通后，平台的最小主干就有了。

## 5. 第一版不应该做的事

下面这些事情即使现在想得到，也不要先写进第一版代码骨架：

- 品类玩法模板
- 插件系统
- 通用事件总线滥用
- 每个游戏自己的独立 server
- 后台超大数据看板

## 6. 判断骨架是否搭对的标准

如果第一版代码骨架符合下面几点，就说明方向对了：

- 新游戏入口只需要加在 `apps/`
- 共享能力都在 `packages/`
- 共用服务端都在 `services/api-server`
- `gameKey` 从入口到服务端都能贯通
- 接口、SQL、后台页面字段命名一致
