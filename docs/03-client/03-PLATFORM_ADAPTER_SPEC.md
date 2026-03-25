# PlatformAdapter 规范

## 1. 目标

`PlatformAdapter` 的职责是屏蔽不同小游戏平台在系统能力上的差异。

它的目标不是做成一个“大一统平台对象”，更不是把广告、支付、奖励、用户体系全部塞进一个类。

它应该只负责那些确实属于平台环境本身的能力差异，例如：

- 启动与初始化
- 登录凭证获取
- 本地存储适配
- 设备能力
- 生命周期
- 分享与震动等轻量系统能力

## 2. 设计原则

### 2.1 平台适配层只抽象“环境能力”

下面这些适合进入 `PlatformAdapter`：

- `init`
- `login`
- `getSystemInfo`
- `getStorage` / `setStorage`
- `vibrateShort`
- `share`
- 生命周期订阅

下面这些不应该直接塞进 `PlatformAdapter`：

- 广告业务逻辑
- 奖励发放逻辑
- 排行榜逻辑
- 活动逻辑
- 结算逻辑

### 2.2 广告能力应与平台能力解耦

虽然不同平台广告 API 不同，但广告仍然应主要由 `AdManager` 负责。

更合理的关系是：

- `PlatformAdapter` 暴露最底层广告创建能力或广告能力探测
- `AdManager` 负责广告缓存、展示策略、失败处理、冷却与场景管理

不要把广告全部直接写进 `PlatformAdapter`，否则这个对象会越来越重。

这里说的“把广告能力挂在平台层”，更准确的意思是：

- 广告底层能力属于平台适配的一部分
- 但它不应该以业务接口的形式直接暴露在 `PlatformAdapter` 根上
- 更适合放在 `PlatformAdapter.ad` 这样的子能力下

### 2.3 适配层只返回原子结果，不返回业务结论

例如：

- 登录返回 `code`、`openId` 或平台 token
- 广告返回“是否完整观看”
- 分享返回“是否调用成功”

它不应该返回：

- 是否发奖励
- 是否升级
- 是否通过新手引导

这些都属于业务层判断。

## 3. 推荐拆分方式

比起一个超大的 `IPlatform`，更推荐“平台入口 + 能力接口”组合。

示意：

```ts
export interface PlatformAuthCapability {
  login(): Promise<{ code?: string; openId?: string }>;
}

export interface PlatformStorageCapability {
  getStorage(key: string): string | null;
  setStorage(key: string, value: string): void;
}

export interface PlatformDeviceCapability {
  getSystemInfo(): unknown;
  vibrateShort(): void;
}

export interface PlatformShareCapability {
  share(payload?: unknown): Promise<void>;
}

export interface PlatformLifecycleCapability {
  onShow(handler: () => void): void;
  onHide(handler: () => void): void;
}

export interface PlatformAdCapability {
  createRewardedVideo(adUnitId: string): RewardedVideoHandle;
  createInterstitial(adUnitId: string): InterstitialHandle;
  createBanner(adUnitId: string): BannerHandle;
}

export interface PlatformAdapter {
  init(): Promise<void>;
  auth: PlatformAuthCapability;
  storage: PlatformStorageCapability;
  device: PlatformDeviceCapability;
  ad?: PlatformAdCapability;
  share?: PlatformShareCapability;
  lifecycle?: PlatformLifecycleCapability;
}
```

这样设计的好处是：

- 可以按能力扩展
- 某些平台缺失某项能力时更容易处理
- 不会因为新增一项能力把整个平台接口推翻

## 4. 广告相关边界

如果首期确实需要平台层接触广告 API，建议只暴露很薄的一层，例如：

```ts
platform.ad?.createRewardedVideo(adUnitId);
```

然后由 `AdManager` 使用这些 handle。

不推荐：

```ts
platform.showRewardAd('revive');
platform.showBanner('home');
```

因为这会让平台层知道业务场景。

这里的区别是：

- `platform.ad?.createRewardedVideo(adUnitId)` 只是平台能力
- `showRewardAd('revive')` 已经是业务语义

前者该属于平台层，后者应该属于 `AdManager`

## 5. 平台实现建议

首期建议实现：

- `WechatPlatformAdapter`
- `DouyinPlatformAdapter`
- `WebMockPlatformAdapter`

其中：

- `WebMockPlatformAdapter` 用于本地开发和回归测试
- 它必须和正式适配器遵守同一套接口

## 6. 必须避免的错误设计

- 让 `PlatformAdapter` 直接负责广告奖励发放
- 让 `PlatformAdapter` 直接管理用户业务信息
- 把平台特有代码散落到游戏业务层
- 因为某个平台特殊，就把所有平台接口改成围绕它设计
- 把某款游戏的分享文案、广告场景、弹窗逻辑写进平台层

## 7. 首期实现建议

首期真正需要做稳的，不是支持很多能力，而是：

- 接口边界稳定
- 能力拆分清楚
- 缺失能力时可降级
- `WebMockPlatformAdapter` 可以跑开发流程

如果这几点做对，后面补更多平台能力时，不需要回头推翻整个适配层。
