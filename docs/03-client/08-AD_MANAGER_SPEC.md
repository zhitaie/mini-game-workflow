# AdManager 规范

## 1. 目标

`AdManager` 的职责是统一管理广告展示行为，而不是直接承担业务奖励发放。

它要解决的问题是：

- 不同平台广告底层 API 不一致
- 同一个游戏内广告展示时机、冷却、失败处理需要统一
- 广告逻辑不能散落在具体玩法代码里

它不负责：

- 决定是否发奖励
- 直接修改存档
- 直接执行业务结算

这些应该交给奖励系统或具体业务层处理。

## 2. 与 PlatformAdapter 的边界

`PlatformAdapter` 负责：

- 创建平台广告对象
- 返回广告底层 handle
- 处理平台能力差异

`AdManager` 负责：

- 广告实例缓存
- 广告展示流程
- 广告失败处理
- 冷却与频控
- 场景映射
- 展示结果标准化

简单说：

- 平台层解决“怎么调平台 API”
- 广告层解决“在游戏里怎么统一使用广告”

## 3. 与业务层的边界

推荐流程：

1. 业务层请求展示广告
2. `AdManager` 负责展示
3. `AdManager` 返回标准化结果
4. 业务层或 `RewardManager` 决定是否发奖励

不推荐：

1. 业务层调用 `AdManager`
2. `AdManager` 直接加金币或发道具

因为这会让广告模块和具体游戏经济系统耦合。

## 4. 广告场景模型

客户端内部应使用稳定的广告场景 key，而不是直接使用广告位 ID。

例如：

```ts
type AdSceneKey =
  | 'homeBanner'
  | 'doubleCoinReward'
  | 'reviveReward';
```

这些 key 由 `game.config.ts` 声明，远程配置再将它们映射到具体广告位和运行参数。

这样做的好处是：

- 场景命名稳定
- 广告位变更不需要修改客户端业务代码
- 平台和运营配置可以独立演进

## 5. 推荐接口

```ts
export type AdType = 'banner' | 'rewardedVideo' | 'interstitial';

export interface ShowAdOptions {
  sceneKey: string;
}

export interface AdResult {
  type: AdType;
  sceneKey: string;
  success: boolean;
  completed?: boolean;
  errorCode?: string;
}

export interface AdManager {
  init(): Promise<void>;
  showRewardedVideo(options: ShowAdOptions): Promise<AdResult>;
  showInterstitial(options: ShowAdOptions): Promise<AdResult>;
  showBanner(options: ShowAdOptions): Promise<AdResult>;
  hideBanner(sceneKey?: string): void;
  preload(sceneKey: string): Promise<void>;
}
```

## 6. 结果语义

建议统一返回：

- `success`
  表示广告流程是否成功执行到平台层返回结果
- `completed`
  主要用于激励视频，表示用户是否完整观看

业务层判断奖励时，应至少基于：

- `success === true`
- `completed === true`

然后再进入服务端校验或奖励发放流程。

## 7. 冷却与频控

`AdManager` 应负责基础冷却与频率控制，但策略数据不应写死在代码里。

这些参数建议来自远程配置：

- 某场景是否开启
- 每次展示冷却时间
- 每日展示上限
- 失败后重试策略

客户端 `AdManager` 只负责执行这些规则。

## 8. 失败处理

不同平台和不同网络环境下，广告失败是常态，不是异常情况。

`AdManager` 首期就应统一处理：

- 平台不支持广告能力
- 广告对象创建失败
- 广告加载失败
- 用户中途关闭
- 平台返回异常状态

这些情况都应转成统一的 `AdResult`，而不是让业务层处理平台细节。

## 9. 必须避免的错误设计

- 让 `AdManager` 直接调用 `SaveManager` 发奖励
- 把广告位 ID 写死在业务代码里
- 把平台广告对象直接暴露给游戏玩法层
- 让每个界面自己处理广告错误码和平台差异
- 把业务场景字符串直接传给 `PlatformAdapter`

## 10. 推荐完整流程

激励广告建议流程：

1. 业务层调用 `AdManager.showRewardedVideo({ sceneKey })`
2. `AdManager` 根据配置解析广告位和规则
3. `AdManager` 调用 `platform.ad` 底层能力
4. `AdManager` 返回标准化 `AdResult`
5. 业务层调用服务端校验接口或奖励接口
6. 业务层或 `RewardManager` 完成最终发奖

这条流程的关键是：

- 广告展示
- 奖励发放
- 存档写入

三件事必须分层。
