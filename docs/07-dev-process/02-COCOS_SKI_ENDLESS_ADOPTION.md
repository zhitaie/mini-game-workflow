# Cocos 接入与滑雪无尽骨架

## 1. 目标

这份文档回答两个问题：

1. 第一款真实游戏为什么要切到 `Cocos Creator`
2. 在不推翻现有仓库的前提下，应该如何接入 `ski-endless`

当前目标不是一次做完完整滑雪游戏，而是先把：

- Cocos 项目形态
- 共享 runtime 接入边界
- 第一款真实游戏目录

这三件事定稳。

## 2. 为什么现在切 Cocos

当前仓库里的 `game-sample` 是协议验证壳，适合验证：

- 登录
- 配置
- 存档
- 广告
- 奖励
- 埋点

但它不适合承载真实小游戏玩法，因为：

- 没有场景系统
- 没有资源工作流
- 没有游戏对象生命周期
- 不能代表小游戏引擎接入的真实成本

所以第一款真实游戏应直接切到 `Cocos Creator`。

## 3. 当前改造原则

### 3.1 保留的部分

下面这些继续保留，不推翻：

- `services/api-server`
- `services/admin-web`
- `packages/game-core-types`
- `packages/game-core-client`
- `apps/game-sample`

### 3.2 新增的部分

新增：

- `apps/ski-endless/`

它是第一款真实游戏的工作目录。

### 3.3 暂不做的部分

当前明确后置：

- 不把现有 `game-sample` 强行改成 Cocos
- 不为了 Cocos 先改服务端协议
- 不先引入重型 `leaderboard` 模块
- 不先切 MySQL

## 4. 目标目录

推荐目录：

```text
apps/
  ski-endless/
    game.config.ts
    README.md
    client/
      package.json
      README.md
      .gitignore
      assets/
        scenes/
        scripts/
      settings/
      extensions/
```

说明：

- `client/` 直接作为 Cocos 项目根目录
- `game.config.ts` 留在 app 根目录，继续作为平台接入声明
- Cocos 生成目录不进入版本库

## 5. Cocos 项目与共享层怎么分工

### 5.1 `apps/ski-endless/client/`

负责：

- 场景
- 资源
- Prefab
- 玩法脚本
- UI 表现

### 5.2 `packages/game-core-client/`

继续负责：

- `NetworkManager`
- `ConfigManager`
- `SaveManager`
- `AnalyticsManager`
- `AdManager`

它不负责：

- 任何具体滑雪玩法
- 任何 Cocos 场景层代码

### 5.3 后续可选扩展

如果 Cocos 接入后发现桥接代码重复，可以后续新增：

```text
packages/game-core-cocos/
```

它只能放：

- 引擎生命周期桥接
- 场景启动胶水代码
- 通用 UI 接入胶水

它不能放：

- 某个游戏专属场景逻辑
- 某个游戏专属资源引用

## 6. 滑雪无尽当前范围

第一版只做一个主模式：

- 无尽模式

第一版同时预留未来扩展口，但不提前做成复杂系统：

- 地图：允许未来有 `snowfield`、`forest`、`night` 等主题地图
- 模式：允许未来有 `endless`、`time_attack`、`challenge` 等模式

当前原则：

- 地图和模式先作为内容层扩展点
- 不先要求平台层对“多模式”有额外抽象
- 先让 `ski-endless` 自己把这些内容组织清楚

## 7. 第一阶段真正要验证什么

对 `ski-endless` 来说，首批必须验证的是：

1. Cocos 项目能被正常纳入 monorepo
2. 能从 Cocos 启动流程中接入现有 runtime
3. 能登录并拿到配置
4. 能读写存档
5. 能触发激励广告与奖励链路
6. 能完成一次真实结算

如果这 6 件事成立，第一款真实游戏接入就成立。

## 8. 下一步代码顺序

推荐顺序：

1. 建 `apps/ski-endless/` 骨架
2. 打开 Cocos，确认项目目录可用
3. 在 Cocos 里建立首个启动场景和 `Boot` 脚本
4. 接入现有 `auth/config/save`
5. 做最小滑雪无尽原型
6. 最后再考虑排行榜

## 9. 当前验收标准

这一轮不是验收玩法完成度，而是验收：

- 目录是否稳定
- 边界是否清楚
- 新游戏是否已经正式脱离 `game-sample`
- 后续是否能在不推翻现有仓库的情况下，进入真实玩法开发
