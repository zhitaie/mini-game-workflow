# 广告校验与奖励发放 API 规范

## 1. 目标

广告展示成功不等于业务奖励一定发放成功。

服务端必须把下面三件事拆开：

- 广告展示结果
- 广告奖励校验
- 奖励发放

这样做的目的是：

- 防止客户端直接伪造奖励
- 保持广告模块与经济系统解耦
- 让奖励发放具备幂等能力

## 2. 总体流程

推荐流程：

1. 客户端通过 `AdManager` 展示激励广告
2. 客户端拿到 `AdResult`
3. 客户端调用服务端广告校验接口
4. 服务端确认广告事件合法
5. 客户端或业务层再调用奖励发放接口
6. 服务端按幂等规则发放奖励并记录日志

这条链路里：

- 广告校验接口不直接修改存档
- 奖励发放接口不依赖前端“我看完了”的口头声明

## 3. 广告校验接口

推荐接口：

```http
POST /api/ad/verify
```

请求体示意：

```json
{
  "sceneKey": "doubleCoinReward",
  "adType": "rewardedVideo",
  "clientTraceId": "trace-123",
  "platformResult": {
    "completed": true
  }
}
```

鉴权要求：

- 必须登录
- 从 token 中恢复 `gameUserId` 和 `gameKey`

## 4. 广告校验接口职责

服务端校验接口至少负责：

- 当前游戏是否启用了该广告场景
- 当前用户是否允许触发该广告场景
- 请求是否带有必要字段
- 当前广告结果是否满足奖励前提
- 写入广告日志

首期可以先做轻量校验，但接口语义必须先定稳。

## 5. 广告校验返回

返回结构必须遵循统一 `ApiResponse` 包装。

建议返回：

```json
{
  "success": true,
  "code": "OK",
  "message": "",
  "data": {
    "verified": true,
    "verificationId": "verify-001",
    "sceneKey": "doubleCoinReward",
    "completed": true
  }
}
```

关键字段：

- `verified`
  表示该广告结果是否通过服务端校验
- `verificationId`
  用于后续奖励发放链路

建议：

- `verificationId` 由服务端生成
- 它至少应在同一 `gameKey` 范围内保持唯一

## 6. 奖励发放接口

推荐接口：

```http
POST /api/reward/claim
```

请求体示意：

```json
{
  "rewardType": "gold",
  "amount": 100,
  "reason": "reward_ad",
  "bizId": "verify-001"
}
```

这里的 `bizId` 是幂等关键字段。

它的作用是：

- 同一个广告验证结果只能发奖一次
- 重试请求不会造成重复发奖

## 7. 奖励发放接口职责

服务端奖励接口应负责：

- 校验当前用户身份
- 校验 `bizId` 是否已发奖
- 校验奖励来源是否合法
- 写入奖励日志
- 在事务内更新可审计的服务端资产余额

这里要明确收口：

- 共用 `/api/reward/claim` 只处理“数值型资产奖励”
- 它的权威落账目标是 `user_asset_balance`
- 它不直接修改各游戏自己的 `save.data`
- 它也不负责复活、解锁关卡、发复杂背包道具这类专属玩法状态

如果某个奖励需要改动游戏专属状态，应进入该游戏自己的服务端模块。

## 8. 幂等规则

奖励发放必须具备幂等能力。

推荐规则：

- `bizId` 全局唯一，至少在同一 `gameKey` 范围内唯一
- 奖励日志表对 `game_key + game_user_id + biz_id` 建唯一约束
- 如果重复请求命中同一个 `bizId`，返回同一条奖励结果或明确的重复状态

## 9. 奖励落账模型

共用奖励接口推荐采用下面的资产模型：

- 一张 `user_asset_balance` 表
- 每行表示某个用户在某个游戏下的一种资产余额
- 唯一键：`(game_key, game_user_id, asset_type)`

这样做的作用是：

- 奖励接口有明确、稳定、可审计的落点
- 不需要共享服务端去理解各游戏自己的存档 JSON 字段
- 后台也能直接查询当前权威余额

请求里的 `rewardType` 在首期应被理解为 `assetType`。

## 10. 推荐错误场景

服务端应能区分至少这些情况：

- 广告未校验通过
- 广告未完整观看
- 场景未开启
- 重复领奖
- 非法 `bizId`
- 奖励参数非法

客户端应根据标准错误码处理，而不是依赖字符串文案判断。

## 11. 奖励发放返回

建议返回：

```json
{
  "success": true,
  "code": "OK",
  "message": "",
  "data": {
    "bizId": "verify-001",
    "rewardType": "gold",
    "amount": 100,
    "balanceAfter": 1280,
    "status": "success"
  }
}
```

## 12. 表关系建议

广告与奖励至少应落两类日志：

- `ad_log`
  记录广告事件和校验结果
- `reward_log`
  记录奖励发放结果和幂等业务号

推荐关系：

- `ad_log.verification_id`
- `reward_log.biz_id = verification_id`

这样后面排查问题时可以串联：

- 哪个广告事件
- 是否校验通过
- 是否发了奖励
- 是否重复请求

## 13. 必须避免的错误设计

- 客户端看完广告后直接改本地资源作为最终结果
- 广告校验接口直接承担奖励发放
- 奖励发放接口没有 `bizId`
- 奖励发放不记日志
- 把广告场景是否合法完全交给客户端决定
- 让共用奖励接口直接写各游戏自己的存档 JSON
