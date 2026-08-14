# 登录与身份规范

## 1. 目标

登录模块必须从第一天就和 `gameKey` 绑定，避免后续第二个游戏接入时重做身份体系。

当前平台的身份模型已经确定：

- 同一个平台用户，在不同游戏中是不同的游戏用户记录

这意味着：

- `gameA` 和 `gameB` 不共享同一条 `game_user`
- token 不应跨游戏复用
- 用户查询和权限判断必须带着明确的游戏上下文

## 2. 推荐数据模型

首期建议采用简单模型：

```ts
game_user
  id
  game_key
  platform
  platform_open_id
  nickname
  avatar
  status
  created_at
  updated_at
  last_login_at
```

唯一键建议：

- `platform + platform_open_id + game_key`

这样可以直接满足当前要求，而不引入额外的全局身份表。

## 3. 登录入参

推荐接口：

```http
POST /api/auth/login
```

请求体建议：

```json
{
  "gameKey": "sim_business",
  "platform": "wechat",
  "code": "platform-login-code",
  "clientVersion": "0.1.0",
  "deviceInfo": {
    "model": "iPhone",
    "osVersion": "18.0"
  }
}
```

## 4. 登录流程

推荐流程：

1. 校验 `gameKey`
2. 调用平台登录能力换取 `platform_open_id`
3. 按 `platform + platform_open_id + gameKey` 查找 `game_user`
4. 如果不存在，则创建一条新的 `game_user`
5. 生成只对当前游戏有效的 token
6. 返回用户基础信息与登录结果

### 当前实现边界

当前 `api-server` 的登录实现仅将入参 `code` 作为本地联调身份键，适用于浏览器样例、自动化验证和没有平台密钥的开发环境。它**不是**微信正式身份认证：微信的 `wx.login()` `code` 是短期一次性凭证，不能直接存入 `platform_open_id`，否则同一玩家在后续登录时可能被创建成多个用户。

微信正式发布前必须在服务端增加独立的身份解析器：使用仅保存在部署 Secrets 中的 AppSecret 调用微信的 code 换 session 流程，得到稳定的 `openid`（以及需要时的会话信息）后，再传入 `game_user` 查询或创建逻辑。AppSecret 不属于 Cocos 客户端、本地配置模板或 Git 仓库。

## 5. token 约束

token 中建议至少包含：

- `gameUserId`
- `gameKey`
- `platform`

作用：

- 避免 token 跨游戏误用
- 让后续接口不需要重新猜测当前用户属于哪个游戏
- 让日志、埋点、后台查询都能还原上下文

## 6. 登录返回

返回结构必须遵循统一 `ApiResponse` 包装。

建议返回：

```json
{
  "success": true,
  "code": "OK",
  "message": "",
  "data": {
    "token": "jwt-or-session-token",
    "user": {
      "id": 1001,
      "gameKey": "sim_business",
      "platform": "wechat",
      "nickname": "",
      "avatar": "",
      "status": "active"
    },
    "isNewUser": true
  }
}
```

## 7. 鉴权规则

后续所有需要登录态的接口都应基于 token 中的：

- `gameUserId`
- `gameKey`

进行鉴权。

不建议仅靠：

- `openId`
- 请求参数里的 `gameKey`

因为这会让调用方有机会在不同游戏数据间串用身份。

## 8. 必须避免的错误设计

- 一个 token 同时访问多个游戏的数据
- 只按 `openId` 查用户，不带 `gameKey`
- 先做全局身份体系，再在上层硬拆游戏隔离
- 登录成功后不把 `gameKey` 写入会话或 token
- 后台查用户时只看平台身份，不看游戏上下文
