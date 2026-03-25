import { mkdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { DatabaseSync } from 'node:sqlite';

const SQLITE_SCHEMA = `
CREATE TABLE IF NOT EXISTS game_user (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  game_key TEXT NOT NULL,
  platform TEXT NOT NULL,
  platform_open_id TEXT NOT NULL,
  nickname TEXT NOT NULL DEFAULT '',
  avatar TEXT NOT NULL DEFAULT '',
  status TEXT NOT NULL DEFAULT 'active',
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL,
  last_login_at INTEGER,
  UNIQUE (game_key, platform, platform_open_id)
);
CREATE INDEX IF NOT EXISTS idx_game_user_game_status ON game_user (game_key, status);
CREATE INDEX IF NOT EXISTS idx_game_user_game_created ON game_user (game_key, created_at);

CREATE TABLE IF NOT EXISTS user_save (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  game_key TEXT NOT NULL,
  game_user_id INTEGER NOT NULL,
  schema_version INTEGER NOT NULL,
  save_data_json TEXT NOT NULL,
  updated_at INTEGER NOT NULL,
  UNIQUE (game_key, game_user_id),
  FOREIGN KEY (game_user_id) REFERENCES game_user (id) ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS idx_user_save_schema ON user_save (game_key, schema_version);

CREATE TABLE IF NOT EXISTS game_config (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  game_key TEXT NOT NULL,
  platform TEXT NOT NULL,
  config_version TEXT NOT NULL,
  min_client_version TEXT,
  max_client_version TEXT,
  config_json TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'draft',
  created_at INTEGER NOT NULL,
  published_at INTEGER,
  archived_at INTEGER,
  updated_at INTEGER NOT NULL,
  UNIQUE (game_key, platform, config_version)
);
CREATE INDEX IF NOT EXISTS idx_game_config_status ON game_config (game_key, platform, status);
CREATE INDEX IF NOT EXISTS idx_game_config_updated ON game_config (game_key, updated_at);

CREATE TABLE IF NOT EXISTS notice (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  game_key TEXT NOT NULL,
  title TEXT NOT NULL,
  content TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'draft',
  start_time INTEGER,
  end_time INTEGER,
  updated_at INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_notice_game_status ON notice (game_key, status);
CREATE INDEX IF NOT EXISTS idx_notice_game_time ON notice (game_key, start_time, end_time);

CREATE TABLE IF NOT EXISTS ad_log (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  game_key TEXT NOT NULL,
  game_user_id INTEGER NOT NULL,
  scene_key TEXT NOT NULL,
  ad_type TEXT NOT NULL,
  client_trace_id TEXT,
  verification_id TEXT NOT NULL,
  verified INTEGER NOT NULL DEFAULT 0,
  completed INTEGER NOT NULL DEFAULT 0,
  error_code TEXT,
  created_at INTEGER NOT NULL,
  UNIQUE (game_key, verification_id),
  FOREIGN KEY (game_user_id) REFERENCES game_user (id) ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS idx_ad_log_user_created ON ad_log (game_key, game_user_id, created_at);
CREATE INDEX IF NOT EXISTS idx_ad_log_scene_created ON ad_log (game_key, scene_key, created_at);
CREATE INDEX IF NOT EXISTS idx_ad_log_client_trace ON ad_log (game_key, client_trace_id);

CREATE TABLE IF NOT EXISTS user_asset_balance (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  game_key TEXT NOT NULL,
  game_user_id INTEGER NOT NULL,
  asset_type TEXT NOT NULL,
  balance INTEGER NOT NULL DEFAULT 0,
  updated_at INTEGER NOT NULL,
  UNIQUE (game_key, game_user_id, asset_type),
  FOREIGN KEY (game_user_id) REFERENCES game_user (id) ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS idx_user_asset_type ON user_asset_balance (game_key, asset_type, updated_at);

CREATE TABLE IF NOT EXISTS reward_log (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  game_key TEXT NOT NULL,
  game_user_id INTEGER NOT NULL,
  reward_type TEXT NOT NULL,
  amount INTEGER NOT NULL,
  reason TEXT NOT NULL,
  biz_id TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'success',
  balance_after INTEGER,
  created_at INTEGER NOT NULL,
  UNIQUE (game_key, game_user_id, biz_id),
  FOREIGN KEY (game_user_id) REFERENCES game_user (id) ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS idx_reward_log_user_created ON reward_log (game_key, game_user_id, created_at);
CREATE INDEX IF NOT EXISTS idx_reward_log_reason_created ON reward_log (game_key, reason, created_at);

CREATE TABLE IF NOT EXISTS analytics_event (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  game_key TEXT NOT NULL,
  game_user_id INTEGER,
  event_name TEXT NOT NULL,
  event_data_json TEXT NOT NULL,
  client_time INTEGER,
  created_at INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_analytics_game_event_created ON analytics_event (game_key, event_name, created_at);
CREATE INDEX IF NOT EXISTS idx_analytics_game_user_created ON analytics_event (game_key, game_user_id, created_at);
`;

export interface DatabaseConnection {
  provider: 'sqlite';
  filePath: string;
  sqlite: DatabaseSync;
  close(): void;
}

export interface DatabaseConnectionOptions {
  filePath?: string;
}

export function createDatabaseConnection(options: DatabaseConnectionOptions = {}): DatabaseConnection {
  const filePath = resolve(options.filePath ?? '.data/dev.sqlite');
  mkdirSync(dirname(filePath), {
    recursive: true
  });

  const sqlite = new DatabaseSync(filePath);
  sqlite.exec('PRAGMA foreign_keys = ON;');
  sqlite.exec(SQLITE_SCHEMA);

  return {
    provider: 'sqlite',
    filePath,
    sqlite,
    close(): void {
      sqlite.close();
    }
  };
}
