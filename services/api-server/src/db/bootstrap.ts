import { createPasswordHash, DEFAULT_ADMIN_ROLES, DEFAULT_ADMIN_USERS, type AdminUserSeed } from '../common/admin.js';
import type { DatabaseConnection, DatabaseConnectionOptions } from './connection.js';
import { createDatabaseConnection } from './connection.js';
import { AdminRoleRepository } from './repositories/admin-role.repository.js';
import { AdminUserRepository } from './repositories/admin-user.repository.js';
import { GameConfigRepository } from './repositories/game-config.repository.js';
import { NoticeRepository } from './repositories/notice.repository.js';

function isProductionEnvironment(): boolean {
  return process.env.NODE_ENV === 'production';
}

function readBootstrapAdminUsers(): AdminUserSeed[] {
  if (!isProductionEnvironment()) {
    return DEFAULT_ADMIN_USERS;
  }

  const password = process.env.MINI_GAME_WORKFLOW_ADMIN_BOOTSTRAP_PASSWORD?.trim();

  if (!password) {
    throw new Error('MINI_GAME_WORKFLOW_ADMIN_BOOTSTRAP_PASSWORD is required in production');
  }

  return [
    {
      username: process.env.MINI_GAME_WORKFLOW_ADMIN_BOOTSTRAP_USERNAME?.trim() || 'admin',
      password,
      displayName: process.env.MINI_GAME_WORKFLOW_ADMIN_BOOTSTRAP_DISPLAY_NAME?.trim() || 'Production Admin',
      roleCode: 'super_admin'
    }
  ];
}

export function ensureDatabaseSeedData(database: DatabaseConnection): void {
  const adminRoleRepository = new AdminRoleRepository(database);
  const adminUserRepository = new AdminUserRepository(database);
  const gameConfigRepository = new GameConfigRepository(database);
  const noticeRepository = new NoticeRepository(database);

  for (const role of DEFAULT_ADMIN_ROLES) {
    adminRoleRepository.upsert({
      code: role.code,
      name: role.name,
      permissions: role.permissions,
      status: 'active'
    });
  }

  for (const user of readBootstrapAdminUsers()) {
    adminUserRepository.upsert({
      username: user.username,
      displayName: user.displayName,
      passwordHash: createPasswordHash(user.password),
      roleCode: user.roleCode,
      status: 'active'
    });
  }

  gameConfigRepository.ensureActive({
    gameKey: 'game_sample',
    platform: 'web',
    configVersion: 'seed-web-v1',
    minClientVersion: '0.1.0',
    maxClientVersion: '0.9.99',
    payload: {
      ad: {
        enabled: false
      }
    }
  });

  gameConfigRepository.setActive({
    gameKey: 'ski_endless',
    platform: 'web',
    configVersion: 'ski-seed-web-v2',
    minClientVersion: '0.1.0',
    maxClientVersion: '0.9.99',
    payload: {
      gameplay: {
        baseSpeed: 6.6,
        maxSpeed: 12.4,
        obstacleDensity: 0.92,
        scorePerMeter: 1
      },
      rewardAd: {
        reviveEnabled: true,
        doubleCoinEnabled: true
      },
      rotation: {
        defaultMode: 'endless',
        defaultMap: 'snowfield',
        availableModes: ['endless'],
        availableMaps: ['snowfield']
      }
    }
  });

  if (noticeRepository.list({ gameKey: 'game_sample' }).length === 0) {
    noticeRepository.create({
      gameKey: 'game_sample',
      title: '欢迎来到样例游戏',
      content: '这是一条用于联调公告链路的默认公告。',
      status: 'active',
      startTime: null,
      endTime: null
    });
  }

  if (noticeRepository.list({ gameKey: 'ski_endless' }).length === 0) {
    noticeRepository.create({
      gameKey: 'ski_endless',
      title: '雪场开放中',
      content: '当前开放 Snowfield Endless 模式。第一版已接入复活、双倍奖励和全服距离榜。',
      status: 'active',
      startTime: null,
      endTime: null
    });
  }
}

export function initializeDatabase(options: DatabaseConnectionOptions = {}): DatabaseConnection {
  const database = createDatabaseConnection(options);
  ensureDatabaseSeedData(database);
  return database;
}
