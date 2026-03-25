# 功能模块注册机制

## 1. 目标

平台后续一定会新增模块，例如：

- 签到
- 任务
- 排行榜
- 活动
- PVP

如果这些模块的接入方式不统一，后果通常是：

- 每新增一个模块，就回头修改所有游戏入口
- 共享初始化流程越来越多 `if/else`
- 旧游戏被新模块无意影响

所以平台需要一个统一的模块注册机制。

## 2. 核心原则

模块接入必须满足：

- 可声明
- 可选
- 可隔离
- 可按游戏启用

换句话说：

- 新增模块不是全局默认生效
- 每个游戏通过自身配置决定是否启用
- 模块初始化失败时，不应拖垮无关模块

## 3. 推荐机制

### 3.1 模块描述

每个共享模块都应有统一描述结构：

```ts
export interface FeatureModule {
  key: string;
  setup(context: FeatureContext): Promise<void> | void;
  isEnabled(config: GameConfig): boolean;
}
```

### 3.2 注册中心

共享层应有统一注册中心，负责：

- 收集已实现模块
- 根据 `game.config.ts` 判断是否启用
- 按顺序初始化模块

示意：

```ts
export interface FeatureRegistry {
  register(module: FeatureModule): void;
  bootstrap(config: GameConfig, context: FeatureContext): Promise<void>;
}
```

## 4. 初始化顺序

建议首期明确初始化顺序，避免后续隐式依赖：

1. platform
2. network
3. config
4. save
5. analytics
6. ads
7. 其他可选业务模块

这个顺序的意义是：

- 平台能力先于业务模块
- 配置和存档先于广告与统计
- 可选模块放在后面接入

## 5. 游戏如何启用模块

示意：

```ts
export default {
  gameKey: 'archery_pvp',
  features: {
    ads: true,
    analytics: true,
    save: true,
    rank: true,
    pvp: true,
  },
};
```

模块注册中心在启动时只初始化 `true` 的模块。

## 6. 模块设计约束

每个模块必须遵守：

- 不读取其他游戏的配置空间
- 不假设所有游戏都有相同数据结构
- 不擅自修改其他模块的内部状态
- 不依赖某款游戏的资源和 UI

## 7. 何时一个能力可以变成共享模块

一个能力进入共享层前，至少回答清楚：

1. 它是否会被两款以上游戏使用？
2. 它是否能通过 `game.config.ts` 声明启用？
3. 它是否有稳定输入输出？
4. 它是否可以不影响未启用它的旧游戏？

只要这四点有明显不确定，就先留在具体游戏内。
