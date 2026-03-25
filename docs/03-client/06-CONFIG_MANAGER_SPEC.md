# ConfigManager 规范

## 1. 目标

`ConfigManager` 的职责是管理配置来源、配置版本和配置读取方式。

它的职责不是：

- 定义某个游戏的全部玩法规则
- 在共享层里写死业务字段
- 用配置系统代替业务逻辑设计

平台后续能否稳定扩展，很大程度上取决于配置系统是否从一开始就支持：

- 本地配置
- 远程配置
- 按游戏隔离
- 版本控制
- 合并策略

## 2. 配置分层

建议从一开始把配置分成三层：

### 2.1 平台静态配置

示例：

- 默认语言
- 默认日志级别
- 公共超时时间

### 2.2 游戏静态配置

示例：

- 游戏默认 UI 常量
- 本地默认奖励参数
- 本地默认广告场景映射

### 2.3 远程动态配置

示例：

- 广告开关
- 活动开关
- 奖励倍率
- 数值参数

## 3. 推荐数据结构

```ts
export interface ConfigEnvelope<TConfig> {
  configVersion: string;
  gameKey: string;
  minClientVersion?: string;
  maxClientVersion?: string;
  payload: Partial<TConfig>;
  updatedAt: number;
}
```

```ts
export interface RemoteConfigRequestContext {
  gameKey: string;
  platform: string;
  clientVersion: string;
}

export interface ConfigSource<TConfig> {
  loadLocal(): Promise<TConfig>;
  loadRemote?(context: RemoteConfigRequestContext): Promise<ConfigEnvelope<TConfig>>;
  merge(local: TConfig, remote?: Partial<TConfig>): TConfig;
}
```

说明：

- `ConfigEnvelope<TConfig>` 的 `payload` 本身就是 `Partial<TConfig>`
- 远程配置应被理解为“局部覆盖补丁”，而不是一整份完整配置

## 4. 推荐接口

```ts
export interface ConfigManager<TConfig> {
  init(source: ConfigSource<TConfig>): Promise<void>;
  getAll(): Readonly<TConfig>;
  get<TValue>(selector: (config: TConfig) => TValue): TValue;
  getVersion(): string;
  refresh(context: RemoteConfigRequestContext): Promise<void>;
}
```

这样定义的原因是：

- 远程配置接口本来就依赖 `gameKey + platform + clientVersion`
- `ConfigManager` 不应假装自己只靠 `gameKey` 就能拿到正确配置
- 文档、客户端实现和服务端 API 需要对齐同一份请求上下文

## 5. 真相源与优先级

配置系统必须避免“双重真相源”。

建议明确分成三层：

1. `game.config.ts`
   作用：接入声明，不属于 `ConfigManager` 的可覆盖范围。
2. 本地默认配置
   作用：运行时默认值。
3. 远程配置
   作用：覆盖本地默认运行参数。

优先级：

- 接入声明不可被远程配置覆盖
- 远程配置可以覆盖本地默认配置
- 本地默认配置负责兜底

## 6. 为什么推荐 selector 风格读取

下面这种字符串路径读取虽然直观，但长期维护性一般：

```ts
ConfigManager.get('ad.rewardScenes.revive');
```

问题在于：

- 字段重命名风险高
- 类型提示弱
- 复杂对象结构下容易写错路径

更推荐：

```ts
ConfigManager.get((config) => config.ad.rewardScenes.revive);
```

这样更利于类型系统约束。

## 7. 合并策略要求

本地配置和远程配置合并时，必须满足：

- 默认值来源明确
- 远程配置缺失字段时，不影响本地默认值
- 不同游戏的配置空间严格隔离
- 同一游戏的旧版本客户端，也能读取可兼容的配置

## 8. 多版本兼容要求

如果客户端会存在多个线上版本并存，那么远程配置至少要支持下面这些规则：

- 允许通过 `minClientVersion` / `maxClientVersion` 判断当前包是否可使用该配置
- 客户端遇到未知字段时，应忽略而不是崩溃
- 字段语义发生重大变化时，应通过新字段或新版本过渡，而不是直接改旧字段含义

最关键的一条是：

- 远程配置更新不能默认假设所有客户端都已升级到最新版本

## 9. 必须避免的错误设计

- 所有游戏共用同一份无隔离的大配置
- 没有 `configVersion`
- 远程配置直接覆盖整份本地配置
- 把第一款游戏的业务参数写进共享层默认配置
- 把配置系统做成万能业务脚本执行器
- 让远程配置覆盖 `game.config.ts` 里的接入声明

## 10. 首期实现建议

首期就应该支持：

- 按 `gameKey` 拉取配置
- 本地默认配置
- 远程局部覆盖
- 版本号记录
- 读取接口稳定
- 基础版本兼容判断

即使一开始远程配置内容不多，这些机制也应该先存在。
