# NetworkManager 规范

## 1. 目标

`NetworkManager` 负责把客户端访问共用服务端的网络行为收敛成统一入口。

它的目标是：

- 统一 HTTP 请求方式
- 统一 token 注入与错误解析
- 统一 `ApiResponse` 包装结构处理
- 让 `ConfigManager`、`SaveManager`、`AnalyticsManager` 不各自重复写请求逻辑

## 2. 职责边界

`NetworkManager` 应负责：

- 发起 HTTP 请求
- 处理超时、基础重试和取消
- 注入公共请求头或鉴权信息
- 解析统一响应结构
- 把标准错误码转换成稳定的客户端异常

`NetworkManager` 不应负责：

- 解释具体业务字段
- 决定奖励逻辑
- 决定存档 schema
- 决定配置字段语义

## 3. 推荐上下文

```ts
export interface NetworkContext {
  baseURL: string;
  gameKey: string;
  platform: string;
  clientVersion: string;
  getToken?: () => string | undefined;
}
```

说明：

- `baseURL` 用于定位共用服务端
- `gameKey`、`platform`、`clientVersion` 是很多接口都会用到的公共上下文
- `getToken` 允许 `NetworkManager` 在请求时动态拿最新登录态

## 4. 推荐接口

```ts
export interface NetworkRequestOptions {
  path: string;
  method: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';
  query?: Record<string, string | number | boolean | undefined>;
  body?: unknown;
  headers?: Record<string, string>;
  requiresAuth?: boolean;
  timeoutMs?: number;
}

export interface NetworkManager {
  init(context: NetworkContext): void;
  request<TData>(options: NetworkRequestOptions): Promise<TData>;
}
```

首期建议保持简单：

- 不要先做过重拦截器体系
- 不要把它演化成万能 SDK
- 先把请求上下文、响应解析和鉴权注入做稳

## 5. 与统一响应结构的关系

服务端已经规定所有接口统一返回：

```json
{
  "success": true,
  "code": "OK",
  "message": "",
  "data": {}
}
```

因此 `NetworkManager.request<TData>()` 的职责不是把整份包裹原样返回给业务层，而是：

1. 先解析顶层 `ApiResponse`
2. `success = true` 时返回 `data`
3. `success = false` 时抛出标准业务异常

这样可以避免每个模块自己重复判断：

- `success`
- `code`
- `message`

## 6. 鉴权约束

对于 `requiresAuth = true` 的请求：

- `NetworkManager` 应自动从 `getToken()` 注入 `Authorization` 头
- 如果当前没有 token，应在客户端尽早抛出鉴权错误

对于不要求登录的请求：

- 也不应丢失 `gameKey`、`platform`、`clientVersion` 这类上下文
- 这些字段仍应通过 query 或 body 显式传给服务端

## 7. 错误模型建议

推荐定义统一异常：

```ts
export class NetworkBusinessError extends Error {
  code: string;
  data: unknown;
}
```

要求：

- 业务层优先基于 `code` 判断
- 不基于字符串文案分支
- HTTP 错误和业务错误都要转换成稳定异常类型

## 8. 与其他客户端模块的关系

`NetworkManager` 是这些模块的基础依赖：

- `ConfigManager`
- `SaveManager`
- `AnalyticsManager`
- 登录流程客户端封装

这几个模块应共享同一个 `NetworkManager` 实例，而不是各自维护请求实现。

## 9. 首期实现建议

首期建议先支持：

- `GET` / `POST`
- query 拼装
- JSON body
- `Authorization` 头注入
- 超时控制
- 统一 `ApiResponse` 解析

后续再考虑：

- 取消请求
- 更复杂的重试策略
- 请求日志采样

## 10. 必须避免的错误设计

- 每个 manager 自己写一套 `fetch`
- 业务层自己解析 `success/code/message`
- 靠文案判断错误分支
- 未登录请求和已登录请求走两套完全不同的协议封装
- 把 `NetworkManager` 做成承载业务逻辑的大杂烩
