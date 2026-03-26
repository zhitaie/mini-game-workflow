# 数据库核心表结构

## 1. 目标

数据库设计必须直接服务于当前已经确定的几条原则：

- 用户按游戏独立记录
- 大多数数据按 `gameKey` 隔离
- 存档采用整体 envelope 模式
- 奖励发放必须支持幂等
- 配置、广告、日志都能按游戏精确筛选

这份文档给的是首期核心表结构和约束方向，不追求一次覆盖所有运营功能。

## 2. 设计原则

### 2.1 先满足隔离，再谈抽象

如果某个表里的数据天然属于某个游戏，就应显式带 `game_key`。

### 2.2 先保留幂等与审计能力

只要涉及奖励、广告、配置、存档，就要优先考虑：

- 是否能查日志
- 是否能防重
- 是否能定位当前游戏和当前用户

### 2.3 不提前做过重拆表

首期以单体服务端和可维护性优先，不必过早拆成复杂范式。

## 3. 核心表

### 3.1 `game_user`

用途：

- 记录某个平台身份在某个 `gameKey` 下的游戏用户

建议字段：

```text
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

关键约束：

- 唯一键：`(game_key, platform, platform_open_id)`

作用：

- 保证同一个平台用户在同一个游戏里只有一条用户记录
- 同一个平台用户在不同游戏中允许存在多条记录

### 3.2 `user_save`

用途：

- 存储当前游戏用户的整份云存档

建议字段：

```text
id
game_key
game_user_id
schema_version
save_data_json
updated_at
```

关键约束：

- 唯一键：`(game_key, game_user_id)`

说明：

- `save_data_json` 存整份 envelope 的 `data` 部分即可
- `schema_version` 单独存列，方便过滤和校验

### 3.3 `game_config`

用途：

- 存远程配置的版本记录与发布状态

建议字段：

```text
id
game_key
platform
config_version
min_client_version
max_client_version
config_json
status
created_at
published_at
archived_at
updated_at
```

关键索引建议：

- `(game_key, platform, status)`
- `(game_key, config_version)`
- 唯一键：`(game_key, platform, config_version)`

说明：

- 这里只保存远程运行参数
- 不保存 `game.config.ts` 里的接入声明
- 同一个 `game_key + platform` 可以存在多份 `active`
- 但这些 `active` 的 `min_client_version / max_client_version` 版本窗口不能重叠
- 配置接口必须按客户端版本只命中一份兼容的 `active`
- `draft` 配置不应被客户端配置接口返回

### 3.4 `notice`

用途：

- 存储公告与运营弹窗

建议字段：

```text
id
game_key
title
content
status
start_time
end_time
updated_at
```

### 3.5 `ad_log`

用途：

- 记录广告校验链路

建议字段：

```text
id
game_key
game_user_id
scene_key
ad_type
client_trace_id
verification_id
verified
completed
error_code
created_at
```

关键索引建议：

- `(game_key, game_user_id, created_at)`
- 唯一键：`(game_key, verification_id)`
- `(game_key, client_trace_id)`

### 3.6 `reward_log`

用途：

- 记录奖励发放结果和幂等业务号

建议字段：

```text
id
game_key
game_user_id
reward_type
amount
reason
biz_id
status
balance_after
created_at
```

关键约束：

- 唯一键：`(game_key, game_user_id, biz_id)`

作用：

- 保证同一个业务事件在同一个游戏用户范围内只发一次奖励
- 为后台和排障提供奖励后的权威余额快照

### 3.7 `user_asset_balance`

用途：

- 作为共用数值型奖励的权威落账表

建议字段：

```text
id
game_key
game_user_id
asset_type
balance
updated_at
```

关键约束：

- 唯一键：`(game_key, game_user_id, asset_type)`

作用：

- 让共用 `reward` 模块有稳定落账目标
- 避免共用服务端直接修改各游戏自己的存档 JSON
- 让后台能直接查询权威资产余额

说明：

- 首期的共用奖励接口只处理这张表上的数值型资产
- 更复杂的背包、道具、专属状态变更应放到游戏专属模块

### 3.8 `analytics_event`

用途：

- 接收和存储埋点事件

建议字段：

```text
id
game_key
game_user_id
event_name
event_data_json
client_time
created_at
```

关键索引建议：

- `(game_key, event_name, created_at)`
- `(game_key, game_user_id, created_at)`

## 4. 关于资产与复杂库存

首期必须有 `user_asset_balance`，因为：

- 共用奖励接口需要权威落账点
- 奖励幂等需要可审计结果
- 后台需要直接查询余额而不是去理解存档 JSON

但这不代表首期要做复杂库存系统。

### 4.1 共用层应支持的内容

- 金币
- 钻石
- 体力
- 其他可抽象成“数值余额”的资产

### 4.2 暂时后置的内容

- 复杂背包
- 时效性道具
- 装备词条
- 游戏专属状态奖励

如果未来确实需要复杂库存，应单独设计游戏专属表，而不是把它们硬塞进共用 `reward`。

## 5. 统一字段约束

建议这些字段在各表中尽量统一命名：

- `game_key`
- `game_user_id`
- `created_at`
- `updated_at`
- `status`

这样做的作用是：

- 降低接口层和后台层的映射复杂度
- 降低跨表排查问题时的认知成本

## 6. 必须避免的错误设计

- 用户表不带 `game_key`
- 存档表没有 `schema_version`
- 奖励日志没有 `biz_id`
- 广告日志和奖励日志无法串联
- 配置表里混入接入声明
- 多个游戏共用一条用户记录

## 7. 首期最小必备表

如果只做第一阶段最小闭环，建议至少先落：

- `game_user`
- `user_save`
- `game_config`
- `notice`
- `ad_log`
- `reward_log`
- `user_asset_balance`
- `analytics_event`

这 8 张表已经能支撑：

- 登录
- 存档
- 配置
- 公告
- 广告校验
- 奖励幂等
- 通用资产落账
- 埋点接收
