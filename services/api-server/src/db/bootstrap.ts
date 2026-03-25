import type { DatabaseConnection, DatabaseConnectionOptions } from './connection.js';
import { createDatabaseConnection } from './connection.js';
import { GameConfigRepository } from './repositories/game-config.repository.js';
import { NoticeRepository } from './repositories/notice.repository.js';

export function ensureDevelopmentSeedData(database: DatabaseConnection): void {
  const gameConfigRepository = new GameConfigRepository(database);
  const noticeRepository = new NoticeRepository(database);

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
