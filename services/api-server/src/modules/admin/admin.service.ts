import { ok } from '../../common/response.js';
import type {
  AdminAdLogItem,
  AdminAuditLogItem,
  AdminAnalyticsEventItem,
  AdminConfigItem,
  AdminDashboardSummary,
  AdminGameUserItem,
  AdminListResult,
  AdminNoticeItem,
  AdminRewardLogItem
} from '@mini-game-workflow/game-core-types';
import type { AdminActor } from '../../common/admin.js';
import type { AdLogRepository } from '../../db/repositories/ad-log.repository.js';
import type { AdminAuditLogRepository } from '../../db/repositories/admin-audit-log.repository.js';
import type { AnalyticsEventRepository } from '../../db/repositories/analytics-event.repository.js';
import type { GameConfigRepository } from '../../db/repositories/game-config.repository.js';
import type { GameUserRepository } from '../../db/repositories/game-user.repository.js';
import type { NoticeRepository } from '../../db/repositories/notice.repository.js';
import type { RewardLogRepository } from '../../db/repositories/reward-log.repository.js';

function startOfToday(now = Date.now()): number {
  const date = new Date(now);
  date.setHours(0, 0, 0, 0);
  return date.getTime();
}

export class AdminService {
  private readonly gameUserRepository: GameUserRepository;
  private readonly gameConfigRepository: GameConfigRepository;
  private readonly noticeRepository: NoticeRepository;
  private readonly adLogRepository: AdLogRepository;
  private readonly rewardLogRepository: RewardLogRepository;
  private readonly analyticsEventRepository: AnalyticsEventRepository;
  private readonly adminAuditLogRepository: AdminAuditLogRepository;

  constructor(
    gameUserRepository: GameUserRepository,
    gameConfigRepository: GameConfigRepository,
    noticeRepository: NoticeRepository,
    adLogRepository: AdLogRepository,
    rewardLogRepository: RewardLogRepository,
    analyticsEventRepository: AnalyticsEventRepository,
    adminAuditLogRepository: AdminAuditLogRepository
  ) {
    this.gameUserRepository = gameUserRepository;
    this.gameConfigRepository = gameConfigRepository;
    this.noticeRepository = noticeRepository;
    this.adLogRepository = adLogRepository;
    this.rewardLogRepository = rewardLogRepository;
    this.analyticsEventRepository = analyticsEventRepository;
    this.adminAuditLogRepository = adminAuditLogRepository;
  }

  getDashboardSummary(gameKey: string) {
    const since = startOfToday();
    const users = this.gameUserRepository.list({ gameKey });
    const summary: AdminDashboardSummary = {
      gameKey,
      totalUsers: users.length,
      todayNewUsers: this.gameUserRepository.countCreatedSince(gameKey, since),
      todayLoginUsers: this.gameUserRepository.countLoggedInSince(gameKey, since),
      adVerifyCount: this.adLogRepository.countSince(gameKey, since),
      rewardCount: this.rewardLogRepository.countSince(gameKey, since),
      analyticsEventCount: this.analyticsEventRepository.countSince(gameKey, since)
    };

    return ok({
      summary
    });
  }

  listUsers(filters: {
    gameKey?: string;
    platform?: string;
    platformOpenId?: string;
    status?: 'active';
  }) {
    const items: AdminGameUserItem[] = this.gameUserRepository.list(filters).map((record) => ({
      id: record.id,
      gameKey: record.gameKey,
      platform: record.platform,
      platformOpenId: record.platformOpenId,
      nickname: record.nickname,
      avatar: record.avatar,
      status: record.status,
      createdAt: record.createdAt,
      lastLoginAt: record.lastLoginAt
    }));

    return ok(this.wrapList(items));
  }

  listConfigs(filters: {
    gameKey?: string;
    platform?: string;
    status?: 'draft' | 'active' | 'archived';
  }) {
    const items: AdminConfigItem[] = this.gameConfigRepository.list(filters).map((record) => ({
      gameKey: record.gameKey,
      platform: record.platform,
      configVersion: record.configVersion,
      minClientVersion: record.minClientVersion,
      maxClientVersion: record.maxClientVersion,
      payload: record.payload,
      status: record.status,
      updatedAt: record.updatedAt
    }));

    return ok(this.wrapList(items));
  }

  saveConfigDraft(input: {
    actor: AdminActor;
    gameKey: string;
    platform: string;
    configVersion: string;
    minClientVersion?: string;
    maxClientVersion?: string;
    payload: Record<string, unknown>;
  }) {
    const record = this.gameConfigRepository.saveDraft({
      gameKey: input.gameKey,
      platform: input.platform,
      configVersion: input.configVersion,
      minClientVersion: input.minClientVersion,
      maxClientVersion: input.maxClientVersion,
      payload: input.payload
    });

    if (!record) {
      return null;
    }

    this.writeAuditLog(input.actor, {
      action: 'config.save_draft',
      targetType: 'game_config',
      targetKey: `${record.gameKey}:${record.platform}:${record.configVersion}`,
      gameKey: record.gameKey,
      detail: {
        platform: record.platform,
        configVersion: record.configVersion,
        status: record.status
      }
    });

    return ok({
      item: {
        gameKey: record.gameKey,
        platform: record.platform,
        configVersion: record.configVersion,
        minClientVersion: record.minClientVersion,
        maxClientVersion: record.maxClientVersion,
        payload: record.payload,
        status: record.status,
        updatedAt: record.updatedAt
      }
    });
  }

  publishConfig(input: {
    actor: AdminActor;
    gameKey: string;
    platform: string;
    configVersion: string;
  }) {
    const record = this.gameConfigRepository.publishVersion(input.gameKey, input.platform, input.configVersion);

    if (!record) {
      return null;
    }

    this.writeAuditLog(input.actor, {
      action: 'config.publish',
      targetType: 'game_config',
      targetKey: `${record.gameKey}:${record.platform}:${record.configVersion}`,
      gameKey: record.gameKey,
      detail: {
        platform: record.platform,
        configVersion: record.configVersion,
        status: record.status
      }
    });

    return ok({
      item: {
        gameKey: record.gameKey,
        platform: record.platform,
        configVersion: record.configVersion,
        minClientVersion: record.minClientVersion,
        maxClientVersion: record.maxClientVersion,
        payload: record.payload,
        status: record.status,
        updatedAt: record.updatedAt
      }
    });
  }

  archiveConfig(input: {
    actor: AdminActor;
    gameKey: string;
    platform: string;
    configVersion: string;
  }) {
    const record = this.gameConfigRepository.archiveVersion(input.gameKey, input.platform, input.configVersion);

    if (!record) {
      return null;
    }

    this.writeAuditLog(input.actor, {
      action: 'config.archive',
      targetType: 'game_config',
      targetKey: `${record.gameKey}:${record.platform}:${record.configVersion}`,
      gameKey: record.gameKey,
      detail: {
        platform: record.platform,
        configVersion: record.configVersion,
        status: record.status
      }
    });

    return ok({
      item: {
        gameKey: record.gameKey,
        platform: record.platform,
        configVersion: record.configVersion,
        minClientVersion: record.minClientVersion,
        maxClientVersion: record.maxClientVersion,
        payload: record.payload,
        status: record.status,
        updatedAt: record.updatedAt
      }
    });
  }

  listNotices(filters: {
    gameKey?: string;
    status?: 'draft' | 'active' | 'archived';
  }) {
    const items: AdminNoticeItem[] = this.noticeRepository.list(filters).map((record) => ({
      id: record.id,
      gameKey: record.gameKey,
      title: record.title,
      content: record.content,
      status: record.status,
      startTime: record.startTime,
      endTime: record.endTime,
      updatedAt: record.updatedAt
    }));

    return ok(this.wrapList(items));
  }

  saveNotice(input: {
    actor: AdminActor;
    id?: number;
    gameKey: string;
    title: string;
    content: string;
    status: 'draft' | 'active' | 'archived';
    startTime: number | null;
    endTime: number | null;
  }) {
    const record =
      input.id === undefined
        ? this.noticeRepository.create(input)
        : this.noticeRepository.update({
            id: input.id,
            gameKey: input.gameKey,
            title: input.title,
            content: input.content,
            status: input.status,
            startTime: input.startTime,
            endTime: input.endTime
          });

    if (!record) {
      return null;
    }

    this.writeAuditLog(input.actor, {
      action: input.id === undefined ? 'notice.create' : 'notice.update',
      targetType: 'notice',
      targetKey: String(record.id),
      gameKey: record.gameKey,
      detail: {
        title: record.title,
        status: record.status
      }
    });

    return ok({
      item: {
        id: record.id,
        gameKey: record.gameKey,
        title: record.title,
        content: record.content,
        status: record.status,
        startTime: record.startTime,
        endTime: record.endTime,
        updatedAt: record.updatedAt
      }
    });
  }

  setNoticeStatus(input: {
    actor: AdminActor;
    gameKey: string;
    id: number;
    status: 'draft' | 'active' | 'archived';
  }) {
    const record = this.noticeRepository.setStatus(input.gameKey, input.id, input.status);

    if (!record) {
      return null;
    }

    this.writeAuditLog(input.actor, {
      action: 'notice.set_status',
      targetType: 'notice',
      targetKey: String(record.id),
      gameKey: record.gameKey,
      detail: {
        status: record.status
      }
    });

    return ok({
      item: {
        id: record.id,
        gameKey: record.gameKey,
        title: record.title,
        content: record.content,
        status: record.status,
        startTime: record.startTime,
        endTime: record.endTime,
        updatedAt: record.updatedAt
      }
    });
  }

  listAdLogs(filters: {
    gameKey?: string;
    gameUserId?: number;
    sceneKey?: string;
    verified?: boolean;
    completed?: boolean;
  }) {
    const items: AdminAdLogItem[] = this.adLogRepository.list(filters).map((record) => ({
      gameKey: record.gameKey,
      gameUserId: record.gameUserId,
      sceneKey: record.sceneKey,
      adType: record.adType,
      clientTraceId: record.clientTraceId,
      verificationId: record.verificationId,
      verified: record.verified,
      completed: record.completed,
      errorCode: record.errorCode,
      createdAt: record.createdAt
    }));

    return ok(this.wrapList(items));
  }

  listRewardLogs(filters: {
    gameKey?: string;
    gameUserId?: number;
    rewardType?: string;
    reason?: string;
    bizId?: string;
  }) {
    const items: AdminRewardLogItem[] = this.rewardLogRepository.list(filters).map((record) => ({
      gameKey: record.gameKey,
      gameUserId: record.gameUserId,
      rewardType: record.rewardType,
      amount: record.amount,
      reason: record.reason,
      bizId: record.bizId,
      status: record.status,
      balanceAfter: record.balanceAfter,
      createdAt: record.createdAt
    }));

    return ok(this.wrapList(items));
  }

  listAnalyticsEvents(filters: {
    gameKey?: string;
    gameUserId?: number;
    eventName?: string;
  }) {
    const items: AdminAnalyticsEventItem[] = this.analyticsEventRepository.listByFilters(filters).map((record) => ({
      gameKey: record.gameKey,
      gameUserId: record.gameUserId,
      eventName: record.eventName,
      eventData: record.eventData,
      clientTime: record.clientTime,
      createdAt: record.createdAt
    }));

    return ok(this.wrapList(items));
  }

  listAuditLogs(filters: {
    gameKey?: string;
    adminUserId?: number;
    action?: string;
    targetType?: string;
    targetKey?: string;
  }) {
    const items: AdminAuditLogItem[] = this.adminAuditLogRepository.list(filters).map((record) => ({
      id: record.id,
      adminUserId: record.adminUserId,
      adminUsername: record.adminUsername,
      roleCode: record.roleCode,
      action: record.action,
      targetType: record.targetType,
      targetKey: record.targetKey,
      gameKey: record.gameKey,
      detail: record.detail,
      createdAt: record.createdAt
    }));

    return ok(this.wrapList(items));
  }

  private wrapList<TItem>(items: TItem[]): AdminListResult<TItem> {
    return {
      items,
      total: items.length
    };
  }

  private writeAuditLog(
    actor: AdminActor,
    input: {
      action: string;
      targetType: string;
      targetKey: string;
      gameKey: string | null;
      detail: Record<string, unknown>;
    }
  ): void {
    this.adminAuditLogRepository.create({
      adminUserId: actor.adminUserId,
      adminUsername: actor.username,
      roleCode: actor.roleCode,
      action: input.action,
      targetType: input.targetType,
      targetKey: input.targetKey,
      gameKey: input.gameKey,
      detail: input.detail
    });
  }
}
