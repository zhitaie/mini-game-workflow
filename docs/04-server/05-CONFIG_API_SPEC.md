# 配置 API 规范

## 1. 目标

配置接口需要和客户端 `ConfigManager` 的规则一致：

- 按 `gameKey` 隔离
- 支持本地默认配置 + 远程局部覆盖
- 支持配置版本
- 支持多版本客户端兼容

## 2. 接口职责

配置接口负责：

- 向客户端返回当前游戏可用的远程配置
- 返回配置版本与兼容范围

它不负责：

- 返回 `game.config.ts` 里的接入声明
- 覆盖客户端接入层能力
- 让后台直接控制未接入的模块

## 3. 推荐接口

```http
GET /api/config
```

鉴权策略：

- 可以按需求决定是否登录后才能拉取
- 即使未登录，也必须明确 `gameKey`

建议请求参数：

- `gameKey`
- `clientVersion`
- `platform`

## 4. 返回结构

返回结构必须遵循统一 `ApiResponse` 包装。

返回示意：

```json
{
  "success": true,
  "code": "OK",
  "message": "",
  "data": {
    "configVersion": "2026-03-26-01",
    "gameKey": "sim_business",
    "minClientVersion": "0.1.0",
    "maxClientVersion": "0.9.99",
    "payload": {
      "ad": {
        "enabled": true,
        "scenes": {
          "homeBanner": {
            "adUnitId": "adunit-001",
            "cooldownSeconds": 30
          }
        }
      },
      "economy": {
        "doubleCoinRate": 2
      }
    },
    "updatedAt": 1740000000
  }
}
```

配置接口只返回当前“已发布生效”的配置，不返回草稿。

## 5. 版本规则

服务端返回的远程配置应允许客户端判断：

- 当前客户端是否在允许版本范围内
- 当前配置版本是否需要刷新本地缓存

推荐规则：

- `configVersion` 用于配置缓存与刷新判断
- `minClientVersion` / `maxClientVersion` 用于客户端兼容判断

## 6. 配置来源与优先级

客户端最终有效配置应遵循：

1. `game.config.ts` 接入声明
2. 本地默认配置
3. 服务端返回的远程配置

服务端接口只能提供第 3 层数据。

这意味着：

- 服务端不能让未接入的模块“凭空出现”
- 服务端不能覆盖 `gameKey`、`targets`、`features`

## 7. 平台与游戏隔离

配置接口必须至少按以下维度隔离或筛选：

- `gameKey`
- `platform`
- `clientVersion`

原因是：

- 不同游戏配置不能串
- 不同平台广告能力可能不同
- 不同客户端版本可支持的配置字段可能不同

## 8. 配置发布模型

后台和服务端需要围绕同一套发布语义协作：

- `draft`
  表示编辑中的配置，不会下发给客户端
- `active`
  表示当前生效配置，配置接口只返回这一类
- `archived`
  表示历史配置，用于回溯或回滚参考

必须满足的规则：

- 同一个 `gameKey + platform` 同一时刻只能有一份 `active`
- 发布新配置时，应在事务内把旧 `active` 归档，并把目标 `draft` 置为 `active`
- 客户端不应看到多份同时生效的配置

## 9. 必须避免的错误设计

- 返回一整份跨游戏混合配置
- 不带 `gameKey` 拉配置
- 服务端返回的远程配置直接覆盖接入声明
- 不考虑客户端版本兼容就直接下发新字段语义
- 用配置接口承担活动脚本执行或复杂逻辑解释
- 把 `draft` 配置直接下发给线上客户端
