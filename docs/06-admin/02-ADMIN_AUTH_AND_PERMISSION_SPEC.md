# 后台认证与权限规范

## 1. 目标

后台控制面必须先解决三件事，再谈更多页面能力：

- 管理员是谁
- 管理员能做什么
- 管理员做了什么

首期实现不追求复杂组织架构，但必须落到真实持久化模型，而不是固定开发 token。

## 2. 核心对象

首期后台认证模型包含 4 张核心表：

- `admin_role`
- `admin_user`
- `admin_session`
- `admin_audit_log`

其中：

- `admin_role` 决定一组稳定权限
- `admin_user` 绑定账号、显示名和角色
- `admin_session` 负责登录态存续与失效
- `admin_audit_log` 记录关键写操作是谁在何时做的

## 3. 首期权限点

首期权限点收敛为：

- `dashboard.read`
- `users.read`
- `configs.read`
- `configs.write`
- `configs.publish`
- `notices.read`
- `notices.write`
- `logs.read`
- `audit.read`

## 4. 首期角色建议

建议首期至少保留这 3 个角色：

- `super_admin`
  拥有所有权限
- `operator`
  允许查询、保存草稿配置、编辑公告，但不能发布配置
- `viewer`
  允许查询，不允许写配置和公告

## 5. 接口约束

后台认证首期至少提供：

- `POST /api/admin/auth/login`
- `GET /api/admin/auth/me`
- `POST /api/admin/auth/logout`

要求：

- 登录成功后返回 `session.token`
- 后续后台请求必须带管理员会话 token
- 会话失效后，后台必须重新登录，而不是继续使用过期 token

## 6. 审计要求

首期必须审计的写操作：

- `config.save_draft`
- `config.publish`
- `config.archive`
- `notice.create`
- `notice.update`
- `notice.set_status`

审计日志至少要记录：

- `admin_user_id`
- `admin_username`
- `role_code`
- `action`
- `target_type`
- `target_key`
- `game_key`
- `detail_json`
- `created_at`

## 7. 本地开发默认账号

当前本地联调默认种子账号：

- `admin / dev-admin-password`
- `operator / dev-operator-password`
- `viewer / dev-viewer-password`

这些账号只用于开发期联调，不应被当成生产方案。
