# API 响应与错误码规范

## 1. 目标

服务端接口必须有统一响应结构和统一错误码规则。

否则后续会出现：

- 不同模块返回格式不一致
- 客户端要为每个接口单独写解析逻辑
- 后台和小游戏前端对错误语义理解不同

这份文档的目标是让：

- 客户端
- 后台
- 服务端

都围绕同一套响应协议协作。

## 2. 推荐响应结构

建议所有业务接口统一返回：

```json
{
  "success": true,
  "code": "OK",
  "message": "",
  "data": {}
}
```

字段含义：

- `success`
  表示请求在业务语义上是否成功
- `code`
  机器可读的稳定错误码或成功码
- `message`
  可选的人类可读提示，不应用于业务判断
- `data`
  具体返回内容

## 3. 成功响应示意

```json
{
  "success": true,
  "code": "OK",
  "message": "",
  "data": {
    "token": "jwt-token"
  }
}
```

## 4. 失败响应示意

```json
{
  "success": false,
  "code": "REWARD_ALREADY_CLAIMED",
  "message": "reward already claimed",
  "data": null
}
```

客户端和后台都应优先基于 `code` 判断，而不是解析 `message`。

## 5. HTTP 状态码建议

建议采用“两层语义”：

- HTTP 状态码表达协议层结果
- `code` 表达业务层结果

推荐规则：

- `200`
  请求成功到达服务端并得到业务响应，不代表业务一定成功
- `400`
  参数格式错误
- `401`
  未登录或 token 无效
- `403`
  有登录态但无权限或状态不允许
- `404`
  资源不存在
- `409`
  幂等冲突、状态冲突、重复操作
- `500`
  服务端内部错误

## 6. 推荐错误码分组

### 6.1 通用

- `OK`
- `BAD_REQUEST`
- `UNAUTHORIZED`
- `FORBIDDEN`
- `NOT_FOUND`
- `INTERNAL_ERROR`

### 6.2 登录与身份

- `INVALID_GAME_KEY`
- `INVALID_PLATFORM`
- `LOGIN_EXCHANGE_FAILED`
- `TOKEN_INVALID`
- `TOKEN_GAME_MISMATCH`
- `USER_NOT_FOUND`
- `USER_DISABLED`

### 6.3 配置

- `CONFIG_NOT_FOUND`
- `CONFIG_VERSION_UNSUPPORTED`
- `CONFIG_PLATFORM_MISMATCH`

### 6.4 存档

- `SAVE_NOT_FOUND`
- `SAVE_SCHEMA_INVALID`
- `SAVE_VERSION_UNSUPPORTED`
- `SAVE_CONFLICT`

### 6.5 广告与奖励

- `AD_SCENE_DISABLED`
- `AD_VERIFY_FAILED`
- `AD_NOT_COMPLETED`
- `REWARD_INVALID_BIZ_ID`
- `REWARD_ALREADY_CLAIMED`
- `REWARD_SOURCE_INVALID`
- `REWARD_AMOUNT_INVALID`

## 7. 错误码设计规则

错误码必须满足：

- 稳定
- 可枚举
- 不依赖文案语言
- 可直接用于前端分支判断和埋点统计

不建议：

- 动态拼接错误码
- 把调试信息塞进错误码
- 让前端通过中文/英文提示文案判断分支

## 8. `data` 的建议规则

建议统一：

- 成功时 `data` 为对象
- 失败时 `data` 为 `null`

如果确实需要失败时返回补充信息，也应保持结构稳定，例如：

```json
{
  "success": false,
  "code": "SAVE_CONFLICT",
  "message": "save conflict",
  "data": {
    "serverUpdatedAt": 1740000001
  }
}
```

## 9. 必须避免的错误设计

- 不同接口返回不同顶层字段名
- 只返回字符串错误信息，不返回稳定错误码
- 把 HTTP 状态码当成全部业务语义
- 失败响应结构和成功响应结构完全不同
- 不同模块对同一个错误返回不同 `code`
