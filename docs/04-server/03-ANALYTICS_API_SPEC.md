# 埋点接收 API 规范

## 1. 目标

服务端埋点接口的职责是：

- 接收客户端批量事件
- 校验最基本的游戏上下文
- 持久化到 `analytics_event`

它的目标不是一开始就做复杂分析平台，而是先把采集链路闭合。

## 2. 推荐接口

```http
POST /api/analytics/events
```

这个接口可以允许匿名调用，也可以带登录态。

规则：

- 匿名场景下，至少必须带 `gameKey`
- 已登录场景下，如果 token 中的 `gameKey` 与请求体不一致，必须拒绝

## 3. 请求体建议

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

要求：

- `events` 不能为空数组
- `eventName` 必须是稳定字符串标识
- `eventData` 必须是可序列化 JSON

## 4. 服务端职责

服务端至少负责：

- 校验 `gameKey`
- 校验请求体结构
- 校验 token 与 `gameKey` 是否一致
- 写入 `analytics_event`

首期不必负责：

- 实时聚合
- 漏斗计算
- 复杂报表

## 5. 返回结构

建议返回：

```json
{
  "success": true,
  "code": "OK",
  "message": "",
  "data": {
    "acceptedCount": 1
  }
}
```

## 6. 数据落地建议

每条事件至少写入：

- `game_key`
- `game_user_id`
- `event_name`
- `event_data_json`
- `client_time`
- `created_at`

其中：

- `game_user_id` 在匿名阶段允许为空
- `created_at` 由服务端生成

## 7. 错误场景建议

至少区分：

- `BAD_REQUEST`
- `INVALID_GAME_KEY`
- `TOKEN_GAME_MISMATCH`

客户端不应依赖提示文案判断。

## 8. 必须避免的错误设计

- 埋点接口不带 `gameKey`
- token 所属游戏和请求体游戏不一致仍然写入
- 为了追求“通用”，把埋点接口设计成万能事件脚本执行器
- 后台要查埋点时才发现服务端没有统一落表
