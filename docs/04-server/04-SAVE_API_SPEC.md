# 存档 API 规范

## 1. 目标

云存档接口要和客户端 `SaveManager` 的 schema/version 机制一致。

接口不应把存档看成若干零散 key-value，而应把它看成：

- 一份按游戏隔离的存档 envelope
- 由当前游戏自己的 schema 定义具体数据结构

## 2. 作用范围

存档 API 负责：

- 获取当前游戏用户的云存档
- 覆盖或更新当前游戏用户的云存档
- 维护 schema 版本和服务端更新时间

它不负责：

- 解释玩法业务含义
- 直接发奖励
- 直接改排行榜

## 3. 推荐数据结构

```ts
export interface SaveEnvelope<TData> {
  schemaVersion: number;
  data: TData;
  updatedAt: number;
}
```

建议服务端持久化时至少带：

- `game_user_id`
- `game_key`
- `schema_version`
- `save_data_json`
- `updated_at`

## 4. 获取存档

推荐接口：

```http
GET /api/save
```

鉴权方式：

- 必须登录
- `gameKey` 从 token 中恢复

返回示意：

```json
{
  "success": true,
  "code": "OK",
  "message": "",
  "data": {
    "save": {
      "schemaVersion": 2,
      "data": {
        "gold": 100,
        "level": 3,
        "offlineIncome": 0
      },
      "updatedAt": 1740000000
    }
  }
}
```

## 5. 更新存档

推荐接口：

```http
POST /api/save
```

请求体示意：

```json
{
  "save": {
    "schemaVersion": 2,
    "data": {
      "gold": 120,
      "level": 3,
      "offlineIncome": 10
    }
  }
}
```

## 6. 更新规则

首期建议采用“整份 envelope 提交”的策略，而不是服务端做复杂字段级 patch。

这样做的好处是：

- 和客户端 `SaveManager` 更一致
- 不需要服务端知道字段语义
- 更适合多游戏多 schema

服务端至少需要校验：

- 当前 token 对应的 `gameKey`
- `schemaVersion` 是否存在
- `save` 结构是否完整

## 7. 版本兼容

服务端对 `schemaVersion` 的职责是：

- 存储并返回当前版本号
- 在必要时拒绝明显不兼容的旧版本写入

服务端不应默认承担所有迁移逻辑。

迁移主责任仍建议在客户端 `SaveManager`。

如果以后要做服务端迁移，也应基于明确的版本规则，而不是隐式修改客户端数据。

## 8. 冲突策略

首期可以先采用简单策略：

- 最后一次成功写入覆盖之前版本

但文档上应预留未来演进空间：

- 客户端提交 `updatedAt`
- 服务端可检测明显旧写入
- 必要时返回冲突错误码

## 9. 必须避免的错误设计

- 按字段零散保存，不保留整体 envelope
- 不存 `schemaVersion`
- 服务端直接理解并操作每个游戏的业务字段
- 不带游戏上下文就写存档
- 用一个接口同时操作多个游戏的存档

## 10. 响应包装要求

无论是获取还是更新存档，都必须遵循统一响应结构：

```json
{
  "success": true,
  "code": "OK",
  "message": "",
  "data": {
    "save": {}
  }
}
```
