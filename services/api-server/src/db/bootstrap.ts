import { createPasswordHash, DEFAULT_ADMIN_ROLES, DEFAULT_ADMIN_USERS } from '../common/admin.js';
import type { DatabaseConnection, DatabaseConnectionOptions } from './connection.js';
import { createDatabaseConnection } from './connection.js';
import { AdminRoleRepository } from './repositories/admin-role.repository.js';
import { AdminUserRepository } from './repositories/admin-user.repository.js';
import { GameConfigRepository } from './repositories/game-config.repository.js';
import { NoticeRepository } from './repositories/notice.repository.js';

export function ensureDevelopmentSeedData(database: DatabaseConnection): void {
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

  for (const user of DEFAULT_ADMIN_USERS) {
    if (!adminUserRepository.findByUsername(user.username)) {
      adminUserRepository.upsert({
        username: user.username,
        displayName: user.displayName,
        passwordHash: createPasswordHash(user.password),
        roleCode: user.roleCode,
        status: 'active'
      });
    }
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

  gameConfigRepository.ensureActive({
    gameKey: 'ski_endless',
    platform: 'web',
    configVersion: 'ski-seed-web-v1',
    minClientVersion: '0.1.0',
    maxClientVersion: '0.9.99',
    payload: {
      gameplay: {
        baseSpeed: 8,
        maxSpeed: 18,
        obstacleDensity: 1,
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
}

export function initializeDevelopmentDatabase(options: DatabaseConnectionOptions = {}): DatabaseConnection {
  const database = createDatabaseConnection(options);
  ensureDevelopmentSeedData(database);
  return database;
}
