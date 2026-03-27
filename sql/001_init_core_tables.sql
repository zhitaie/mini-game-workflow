CREATE TABLE `admin_role` (
  `code` VARCHAR(64) NOT NULL,
  `name` VARCHAR(128) NOT NULL,
  `permissions_json` JSON NOT NULL,
  `status` VARCHAR(32) NOT NULL DEFAULT 'active',
  `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`code`)
);

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
);

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
);

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
);

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
  UNIQUE KEY `uk_game_user_identity` (`game_key`, `platform`, `platform_open_id`)
);

CREATE TABLE `user_save` (
  `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  `game_key` VARCHAR(64) NOT NULL,
  `game_user_id` BIGINT UNSIGNED NOT NULL,
  `schema_version` INT NOT NULL,
  `save_data_json` JSON NOT NULL,
  `updated_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_user_save_game_user` (`game_key`, `game_user_id`)
);

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
  UNIQUE KEY `uk_game_config_version` (`game_key`, `platform`, `config_version`)
);

CREATE TABLE `notice` (
  `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  `game_key` VARCHAR(64) NOT NULL,
  `title` VARCHAR(255) NOT NULL,
  `content` TEXT NOT NULL,
  `status` VARCHAR(32) NOT NULL DEFAULT 'draft',
  `start_time` DATETIME DEFAULT NULL,
  `end_time` DATETIME DEFAULT NULL,
  `updated_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`)
);

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
  UNIQUE KEY `uk_ad_log_verification` (`game_key`, `verification_id`)
);

CREATE TABLE `user_asset_balance` (
  `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  `game_key` VARCHAR(64) NOT NULL,
  `game_user_id` BIGINT UNSIGNED NOT NULL,
  `asset_type` VARCHAR(64) NOT NULL,
  `balance` BIGINT NOT NULL DEFAULT 0,
  `updated_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_user_asset_balance` (`game_key`, `game_user_id`, `asset_type`)
);

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
  UNIQUE KEY `uk_reward_log_biz` (`game_key`, `game_user_id`, `biz_id`)
);

CREATE TABLE `analytics_event` (
  `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  `game_key` VARCHAR(64) NOT NULL,
  `game_user_id` BIGINT UNSIGNED DEFAULT NULL,
  `event_name` VARCHAR(128) NOT NULL,
  `event_data_json` JSON NOT NULL,
  `client_time` DATETIME DEFAULT NULL,
  `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`)
);
