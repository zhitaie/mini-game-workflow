# 后台核心页面规范

## 1. 目标

这份文档聚焦首期最值得做的后台页面：

- 仪表盘
- 配置管理页
- 用户查询页
- 公告管理页
- 广告日志页
- 奖励日志页
- 埋点查询页
- 审计日志页

目标不是页面做得多复杂，而是让你能稳定排查和运营多个游戏。

## 2. 配置管理页

### 2.1 页面职责

管理远程运行配置，例如：

- 广告开关
- 广告位映射
- 奖励倍率
- 活动状态

### 2.2 页面约束

- 必须按 `gameKey` 切换
- 必须支持 `platform` 维度
- 必须展示 `configVersion`
- 必须区分“当前生效配置”和“编辑中的配置”
- 必须明确 `draft / active / archived` 状态
- 写操作必须受管理员权限控制，并进入审计日志

### 2.3 必须避免

- 修改 `game.config.ts`
- 把接入声明和远程配置混在一个表单里
- 发布新配置时不记录版本

### 2.4 发布动作要求

配置发布时，后台必须通过服务端完成：

- 将目标 `draft` 发布为 `active`
- 校验它和现有 `active` 的客户端版本窗口不重叠
- 允许多个 `active` 并存，但必须按版本窗口隔离
- 支持把某个 `active` 明确归档为 `archived`

## 3. 仪表盘

### 3.1 页面职责

首期只做轻量总览，不做重型 BI。

建议展示：

- 当日新增用户
- 当日登录用户
- 广告校验次数
- 奖励发放次数
- 埋点上报次数

### 3.2 数据来源

建议先基于这些表做轻量统计：

- `game_user`
- `ad_log`
- `reward_log`
- `analytics_event`

## 4. 用户查询页

### 4.1 页面职责

用于查询 `game_user` 和关联信息。

建议支持筛选：

- `gameKey`
- `platform`
- `platform_open_id`
- `status`
- `created_at` 范围

### 4.2 页面展示建议

建议首期展示：

- `game_user.id`
- `game_key`
- `platform`
- `platform_open_id`
- `nickname`
- `status`
- `last_login_at`

### 4.3 扩展建议

后续可以增加：

- 最近存档更新时间
- 最近广告日志
- 最近奖励日志

## 5. 公告管理页

### 5.1 页面职责

管理 `notice` 表对应的公告。

建议支持：

- 创建
- 编辑
- 上线/下线
- 预览生效时间

### 5.2 页面约束

- 公告必须带 `gameKey`
- 公告状态与时间范围必须可见
- 后台保存操作必须走服务端接口
- 公告创建、编辑、状态切换必须有审计记录

## 6. 广告日志页

### 6.1 页面职责

用于查看 `ad_log`。

建议支持筛选：

- `gameKey`
- `gameUserId`
- `sceneKey`
- `verified`
- `completed`
- `created_at` 范围

### 6.2 页面展示建议

- `verification_id`
- `client_trace_id`
- `scene_key`
- `ad_type`
- `verified`
- `completed`
- `error_code`
- `created_at`

### 6.3 页面作用

主要用于定位：

- 为什么用户没拿到奖励
- 某个广告场景失败率是否过高
- 客户端是否出现重复上报

## 7. 奖励日志页

### 7.1 页面职责

用于查看 `reward_log` 和幂等状态。

建议支持筛选：

- `gameKey`
- `gameUserId`
- `reward_type`
- `reason`
- `biz_id`
- `status`
- `created_at` 范围

### 7.2 页面展示建议

- `biz_id`
- `reward_type`
- `amount`
- `reason`
- `status`
- `balance_after`
- `created_at`

### 7.3 页面作用

主要用于定位：

- 是否重复领奖
- 某次奖励是否真的发出
- 奖励发放与广告校验日志是否能串起来

## 8. 埋点查询页

### 8.1 页面职责

用于查看 `analytics_event`。

建议支持筛选：

- `gameKey`
- `gameUserId`
- `event_name`
- `created_at` 范围

### 8.2 页面展示建议

- `event_name`
- `game_user_id`
- `client_time`
- `created_at`
- `event_data_json`

### 8.3 页面作用

主要用于定位：

- 某个事件是否真的上报成功
- 某次用户操作链路是否完整
- 客户端版本切换后事件结构是否异常

## 9. 审计日志页

### 9.1 页面职责

用于查看 `admin_audit_log`，确认后台关键写操作的操作者、动作、对象和时间。

建议支持筛选：

- `gameKey`
- `adminUserId`
- `action`
- `target_type`
- `target_key`

### 9.2 页面展示建议

- `created_at`
- `admin_username`
- `role_code`
- `action`
- `target_type`
- `target_key`
- `detail_json`

### 9.3 页面作用

主要用于定位：

- 某个配置版本是谁发布或归档的
- 某条公告最近被谁改过
- 某个后台写操作是否真的落库

## 10. 页面间联动建议

首期后台最有价值的不是图表，而是联动定位能力。

建议支持：

- 从用户页跳到该用户的广告日志
- 从用户页跳到该用户的埋点查询
- 从广告日志跳到对应 `verification_id`
- 从奖励日志按 `biz_id` 回查广告校验记录
- 从配置页跳到对应配置版本的审计日志
- 从公告页跳到对应公告的审计日志

## 11. 必须避免的错误设计

- 奖励日志页看不到 `biz_id`
- 广告日志页看不到 `verification_id`
- 页面筛选条件不带 `gameKey`
- 配置页保存后看不到 `configVersion`
- 后台页面字段命名与数据库、接口字段脱节
- 没有登录态或没有权限的管理员也能执行发布、归档、公告编辑
- 做了配置发布和公告修改，却没有页面能回查审计记录
