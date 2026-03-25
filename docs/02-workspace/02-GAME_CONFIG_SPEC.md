# 游戏接入配置规范

## 1. 目标

`game.config.ts` 是每个游戏接入平台底座的统一入口。

它的职责不是承载复杂业务逻辑，而是声明：

- 这是哪一个游戏
- 这个游戏启用了哪些共享能力
- 这个游戏需要哪些平台、配置空间和构建参数

如果这个文件边界不清晰，后续新增游戏时就容易出现：

- 接入步骤不一致
- 共享层不知道该如何初始化
- 构建和发布逻辑到处写分支

这份文件本质上是“接入声明文件”，不是“运行时业务配置文件”。

## 2. 必须具备的字段

建议每个游戏的 `game.config.ts` 至少包含下面这些字段：

```ts
export interface GameConfig {
  gameKey: string;
  gameName: string;
  clientVersion: string;
  targets: PlatformTarget[];
  features: FeatureFlags;
  configNamespace: string;
  saveNamespace: string;
  adScenes?: Record<string, string>;
}
```

### 2.1 `gameKey`

唯一标识一个游戏。

要求：

- 全仓库唯一
- 一旦上线后不再修改
- 同时用于客户端、服务端、后台、埋点、构建与发布隔离

### 2.2 `gameName`

面向产品和管理端展示的游戏名称。

### 2.3 `clientVersion`

客户端版本号。

要求：

- 与构建产物绑定
- 可用于埋点与服务端兼容判断

### 2.4 `targets`

表示这个游戏支持哪些平台目标。

示意：

```ts
type PlatformTarget = 'wechat' | 'douyin' | 'web';
```

### 2.5 `features`

声明这个游戏启用了哪些可选模块。

示意：

```ts
export interface FeatureFlags {
  ads: boolean;
  analytics: boolean;
  save: boolean;
  notice: boolean;
  signIn?: boolean;
  task?: boolean;
  rank?: boolean;
  pvp?: boolean;
}
```

原则：

- 新增模块优先通过 `features` 启用
- 默认值应尽量保持兼容
- 旧游戏不应因为共享层升级而被动开启新模块

这里的 `features` 要理解成：

- 这是一个接入声明
- 它回答的是“这个游戏有没有接这个系统”
- 它不回答“这个系统当前怎么运行”

例如：

- `rank: true` 表示该游戏接入了排行榜模块
- “当前赛季是否开启排行榜”不属于 `features`，而属于远程配置

### 2.6 `configNamespace`

标识该游戏的远程配置空间。

作用：

- 服务端按该命名空间组织配置
- 后台按该命名空间管理配置

### 2.7 `saveNamespace`

标识该游戏的存档空间。

作用：

- 防止多个游戏共用本地存储键
- 防止云存档结构互相污染

### 2.8 `adScenes`

可选字段。

用于声明当前游戏内部使用的稳定广告场景 key，而不是把广告位 ID 或后台运行参数写死在共享层里。

建议理解为：

- `adScenes` 负责定义客户端会使用到哪些稳定场景名
- 广告位 ID、开关、频率、冷却时间应由远程配置控制

## 3. 推荐示例

```ts
import type { GameConfig } from '../../packages/game-core-types';

const config: GameConfig = {
  gameKey: 'sim_business',
  gameName: 'Deep Night Store',
  clientVersion: '0.1.0',
  targets: ['wechat', 'douyin'],
  features: {
    ads: true,
    analytics: true,
    save: true,
    notice: true,
    signIn: false,
    task: false,
    rank: false,
    pvp: false,
  },
  configNamespace: 'sim_business',
  saveNamespace: 'sim_business',
  adScenes: {
    homeBanner: 'home_banner',
    doubleCoinReward: 'double_coin_reward',
  },
};

export default config;
```

## 4. 真相源与优先级

`game.config.ts` 与远程配置必须明确分工。

### 4.1 `game.config.ts` 管什么

这份文件负责不可或缺的接入信息：

- `gameKey`
- `gameName`
- `targets`
- `features`
- `configNamespace`
- `saveNamespace`
- 稳定的广告场景 key

这些内容默认由代码定义，不允许由后台直接覆盖。

### 4.2 远程配置管什么

远程配置负责运行时参数：

- 广告开关
- 广告位 ID
- 奖励倍率
- 活动状态
- 数值参数

### 4.3 优先级规则

建议统一采用下面的优先级：

1. `game.config.ts`：接入声明，优先级最高，不允许远程覆盖。
2. 本地默认配置：运行时默认值。
3. 远程配置：允许覆盖本地默认运行参数，但不能推翻接入声明。

例如：

- 远程配置不能把 `features.rank = false` 的游戏强行改成接入排行榜
- 远程配置可以在 `features.rank = true` 的前提下控制排行榜当前是否开启

## 5. 不应该放进 `game.config.ts` 的内容

下面这些不应该写进这个文件：

- 复杂玩法参数
- 结算逻辑
- 奖励计算规则
- UI 流程逻辑
- 平台 API 具体实现

原因是：

- 这些内容变化快
- 它们属于业务层
- 一旦写进接入配置，会让平台入口和业务层耦合

## 6. 兼容与演进规则

后续扩展该文件时，遵循：

1. 优先新增可选字段，不直接修改旧字段语义。
2. 新模块通过新 feature flag 启用。
3. 必填字段一旦上线，尽量不改名。
4. 需要废弃字段时，先保留兼容，再逐步移除。
5. 接入声明一旦上线，不允许被远程配置绕开。
