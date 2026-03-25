# AnalyticsManager 规范

## 1. 目标

`AnalyticsManager` 负责统一小游戏客户端的埋点上报入口。

它的目标是：

- 统一事件采集接口
- 统一公共上下文注入
- 统一批量上报与失败处理策略
- 避免每个游戏页面自己散写埋点请求

## 2. 职责边界

`AnalyticsManager` 应负责：

- 记录事件
- 为事件附加公共上下文
- 批量发送到服务端
- 在网络失败时做轻量缓冲或重试

`AnalyticsManager` 不应负责：

- 做数据分析
- 负责后台图表
- 决定运营口径
- 直接把业务判断写死在共享层

## 3. 推荐公共上下文

```ts
export interface AnalyticsContext {
  gameKey: string;
  platform: string;
  clientVersion: string;
  sessionId: string;
  gameUserId?: number;
}
```

说明：

- `sessionId` 用于串联一次启动周期内的事件
- `gameUserId` 允许匿名阶段为空，登录后再补充

## 4. 推荐事件结构

```ts
export interface AnalyticsEventInput {
  eventName: string;
  eventData?: Record<string, unknown>;
  clientTime?: number;
}
```

事件命名建议：

- 使用稳定英文标识
- 不要依赖中文文案
- 不要把动态值拼进事件名

例如：

- `game_launch`
- `login_success`
- `ad_reward_verify_success`

不建议：

- `用户登录成功`
- `level_3_completed`

## 5. 推荐接口

```ts
export interface AnalyticsManager {
  init(context: AnalyticsContext): void;
  setUserContext(gameUserId: number): void;
  track(event: AnalyticsEventInput): void;
  flush(): Promise<void>;
}
```

说明：

- `track()` 应尽量轻量，避免阻塞主线程
- `flush()` 可在切后台、切场景或固定间隔时调用

## 6. 与服务端 API 的关系

`AnalyticsManager` 应通过共用服务端埋点接口上报，例如：

```http
POST /api/analytics/events
```

建议请求体：

```json
{
  "gameKey": "sim_business",
  "platform": "wechat",
  "clientVersion": "0.1.0",
  "sessionId": "session-001",
  "events": [
    {
      "eventName": "game_launch",
      "eventData": {
        "entry": "default"
      },
      "clientTime": 1740000000
    }
  ]
}
```

## 7. 失败策略

埋点属于“尽量送达”，不应阻塞核心玩法链路。

建议：

- 上报失败时允许稍后重试
- 不因埋点失败阻止登录、存档或奖励流程
- 队列应有大小上限，避免无限堆积

## 8. 与 `features.analytics` 的关系

如果某个游戏未启用 `analytics`：

- 应返回 no-op 实现
- 游戏业务层不应因此额外分叉大量代码

这也是 `features` 作为接入声明的价值之一。

## 9. 后台与服务端依赖

`AnalyticsManager` 的存在意味着下游必须同时具备：

- 服务端埋点接收接口
- `analytics_event` 表
- 后台埋点查询页

否则埋点只会停留在“客户端发出去了”，而不是一条可排查链路。

## 10. 必须避免的错误设计

- 每个页面自己直接请求 `/api/analytics`
- 事件名和字段名经常改动
- 把埋点事件做成无上限缓存
- 埋点失败时阻塞核心业务流程
- 没有统一上下文，导致后台无法按 `gameKey` 或会话排查
