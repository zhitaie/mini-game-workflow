# 首期 SQL 草案

## 1. 目标

这份文档给出首期核心表的 SQL 草案，目标是：

- 与当前数据模型文档保持一致
- 支撑第一阶段最小闭环
- 让后续真正开始写服务端代码时，不需要重新想字段命名

当前草案以 MySQL 8 为默认前提。

## 2. 命名约定

统一约定：

- 主键使用 `BIGINT UNSIGNED`
- 时间使用 `DATETIME`
- JSON 内容使用 `JSON`
- 状态字段使用 `VARCHAR(32)`
- 所有表和索引命名尽量简洁稳定

## 3. 后台控制面表

### 3.1 `admin_role`

```sql
CREATE TABLE `admin_role` (
  `code` VARCHAR(64) NOT NULL,
  `name` VARCHAR(128) NOT NULL,
  `permissions_json` JSON NOT NULL,
  `status` VARCHAR(32) NOT NULL DEFAULT 'active',
  `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`code`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
```

### 3.2 `admin_user`

```sql
CREATE TABLE `admin_user` (
  `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  `username` VARCHAR(128) NOT NULL,
  `display_name` VARCHAR(128) NOT NULL,
  `password_hash` VARCHAR(255) NOT NULL,
  `role_code` VARCHAR(64) NOT NULL,
  `status` VARCHAR(32) NOT NULL DEFAULT 'active',
  `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_admin_user_username` (`username`),
  KEY `idx_admin_user_role_status` (`role_code`, `status`),
  CONSTRAINT `fk_admin_user_role`
    FOREIGN KEY (`role_code`) REFERENCES `admin_role` (`code`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
```

### 3.3 `admin_session`

```sql
CREATE TABLE `admin_session` (
  `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  `admin_user_id` BIGINT UNSIGNED NOT NULL,
  `session_token_hash` VARCHAR(255) NOT NULL,
  `expires_at` DATETIME NOT NULL,
  `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `last_seen_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `revoked_at` DATETIME DEFAULT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_admin_session_token` (`session_token_hash`),
  KEY `idx_admin_session_user` (`admin_user_id`, `expires_at`),
  KEY `idx_admin_session_active` (`expires_at`, `revoked_at`),
  CONSTRAINT `fk_admin_session_user`
    FOREIGN KEY (`admin_user_id`) REFERENCES `admin_user` (`id`)
    ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
```

### 3.4 `admin_audit_log`

```sql
CREATE TABLE `admin_audit_log` (
  `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  `admin_user_id` BIGINT UNSIGNED NOT NULL,
  `admin_username` VARCHAR(128) NOT NULL,
  `role_code` VARCHAR(64) NOT NULL,
  `action` VARCHAR(128) NOT NULL,
  `target_type` VARCHAR(64) NOT NULL,
  `target_key` VARCHAR(255) NOT NULL,
  `game_key` VARCHAR(64) DEFAULT NULL,
  `detail_json` JSON NOT NULL,
  `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_admin_audit_game_created` (`game_key`, `created_at`),
  KEY `idx_admin_audit_actor_created` (`admin_user_id`, `created_at`),
  KEY `idx_admin_audit_action_created` (`action`, `created_at`),
  CONSTRAINT `fk_admin_audit_user`
    FOREIGN KEY (`admin_user_id`) REFERENCES `admin_user` (`id`)
    ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
```

## 4. `game_user`

```sql
CREATE TABLE `game_user` (
  `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  `game_key` VARCHAR(64) NOT NULL,
  `platform` VARCHAR(32) NOT NULL,
  `platform_open_id` VARCHAR(128) NOT NULL,
  `nickname` VARCHAR(128) NOT NULL DEFAULT '',
  `avatar` VARCHAR(512) NOT NULL DEFAULT '',
  `status` VARCHAR(32) NOT NULL DEFAULT 'active',
  `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  `last_login_at` DATETIME NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_game_user_identity` (`game_key`, `platform`, `platform_open_id`),
  KEY `idx_game_user_game_status` (`game_key`, `status`),
  KEY `idx_game_user_game_created` (`game_key`, `created_at`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
```

## 5. `user_save`

```sql
CREATE TABLE `user_save` (
  `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  `game_key` VARCHAR(64) NOT NULL,
  `game_user_id` BIGINT UNSIGNED NOT NULL,
  `schema_version` INT NOT NULL,
  `save_data_json` JSON NOT NULL,
  `updated_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_user_save_game_user` (`game_key`, `game_user_id`),
  KEY `idx_user_save_schema` (`game_key`, `schema_version`),
  CONSTRAINT `fk_user_save_game_user`
    FOREIGN KEY (`game_user_id`) REFERENCES `game_user` (`id`)
    ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
```

## 6. `game_config`

```sql
CREATE TABLE `game_config` (
  `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  `game_key` VARCHAR(64) NOT NULL,
  `platform` VARCHAR(32) NOT NULL,
  `config_version` VARCHAR(64) NOT NULL,
  `min_client_version` VARCHAR(32) DEFAULT NULL,
  `max_client_version` VARCHAR(32) DEFAULT NULL,
  `config_json` JSON NOT NULL,
  `status` VARCHAR(32) NOT NULL DEFAULT 'draft',
  `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `published_at` DATETIME DEFAULT NULL,
  `archived_at` DATETIME DEFAULT NULL,
  `updated_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_game_config_version` (`game_key`, `platform`, `config_version`),
  KEY `idx_game_config_status` (`game_key`, `platform`, `status`),
  KEY `idx_game_config_updated` (`game_key`, `updated_at`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
```

补充约束说明：

- 同一个 `game_key + platform` 可以有多条 `status = active`
- 但这些 `active` 的客户端版本窗口不能重叠
- 这个约束首期由服务端发布事务保证，不依赖数据库部分索引

## 7. `notice`

```sql
CREATE TABLE `notice` (
  `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  `game_key` VARCHAR(64) NOT NULL,
  `title` VARCHAR(255) NOT NULL,
  `content` TEXT NOT NULL,
  `status` VARCHAR(32) NOT NULL DEFAULT 'draft',
  `start_time` DATETIME DEFAULT NULL,
  `end_time` DATETIME DEFAULT NULL,
  `updated_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_notice_game_status` (`game_key`, `status`),
  KEY `idx_notice_game_time` (`game_key`, `start_time`, `end_time`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
```

## 8. `ad_log`

```sql
CREATE TABLE `ad_log` (
  `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  `game_key` VARCHAR(64) NOT NULL,
  `game_user_id` BIGINT UNSIGNED NOT NULL,
  `scene_key` VARCHAR(64) NOT NULL,
  `ad_type` VARCHAR(32) NOT NULL,
  `client_trace_id` VARCHAR(128) DEFAULT NULL,
  `verification_id` VARCHAR(128) NOT NULL,
  `verified` TINYINT(1) NOT NULL DEFAULT 0,
  `completed` TINYINT(1) NOT NULL DEFAULT 0,
  `error_code` VARCHAR(64) DEFAULT NULL,
  `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_ad_log_verification` (`game_key`, `verification_id`),
  KEY `idx_ad_log_user_created` (`game_key`, `game_user_id`, `created_at`),
  KEY `idx_ad_log_scene_created` (`game_key`, `scene_key`, `created_at`),
  KEY `idx_ad_log_client_trace` (`game_key`, `client_trace_id`),
  CONSTRAINT `fk_ad_log_game_user`
    FOREIGN KEY (`game_user_id`) REFERENCES `game_user` (`id`)
    ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
```

## 9. `reward_log`

```sql
CREATE TABLE `reward_log` (
  `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  `game_key` VARCHAR(64) NOT NULL,
  `game_user_id` BIGINT UNSIGNED NOT NULL,
  `reward_type` VARCHAR(64) NOT NULL,
  `amount` BIGINT NOT NULL,
  `reason` VARCHAR(64) NOT NULL,
  `biz_id` VARCHAR(128) NOT NULL,
  `status` VARCHAR(32) NOT NULL DEFAULT 'success',
  `balance_after` BIGINT DEFAULT NULL,
  `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_reward_log_biz` (`game_key`, `game_user_id`, `biz_id`),
  KEY `idx_reward_log_user_created` (`game_key`, `game_user_id`, `created_at`),
  KEY `idx_reward_log_reason_created` (`game_key`, `reason`, `created_at`),
  CONSTRAINT `fk_reward_log_game_user`
    FOREIGN KEY (`game_user_id`) REFERENCES `game_user` (`id`)
    ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
```

## 10. `user_asset_balance`

```sql
CREATE TABLE `user_asset_balance` (
  `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  `game_key` VARCHAR(64) NOT NULL,
  `game_user_id` BIGINT UNSIGNED NOT NULL,
  `asset_type` VARCHAR(64) NOT NULL,
  `balance` BIGINT NOT NULL DEFAULT 0,
  `updated_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_user_asset_balance` (`game_key`, `game_user_id`, `asset_type`),
  KEY `idx_user_asset_type` (`game_key`, `asset_type`, `updated_at`),
  CONSTRAINT `fk_user_asset_balance_game_user`
    FOREIGN KEY (`game_user_id`) REFERENCES `game_user` (`id`)
    ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
```

## 11. `analytics_event`

```sql
CREATE TABLE `analytics_event` (
  `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  `game_key` VARCHAR(64) NOT NULL,
  `game_user_id` BIGINT UNSIGNED DEFAULT NULL,
  `event_name` VARCHAR(128) NOT NULL,
  `event_data_json` JSON NOT NULL,
  `client_time` DATETIME DEFAULT NULL,
  `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_analytics_game_event_created` (`game_key`, `event_name`, `created_at`),
  KEY `idx_analytics_game_user_created` (`game_key`, `game_user_id`, `created_at`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
```

## 12. 首期执行顺序建议

如果要开始建表，建议顺序：

1. `admin_role`
2. `admin_user`
3. `admin_session`
4. `admin_audit_log`
5. `game_user`
6. `user_save`
7. `game_config`
8. `notice`
9. `ad_log`
10. `user_asset_balance`
11. `reward_log`
12. `analytics_event`

这个顺序与当前实现计划一致。
