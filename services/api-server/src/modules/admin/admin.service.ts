import { ok } from '../../common/response.js';
import type {
  AdminAdLogItem,
  AdminAnalyticsEventItem,
  AdminConfigItem,
  AdminDashboardSummary,
  AdminGameUserItem,
  AdminListResult,
  AdminNoticeItem,
  AdminRewardLogItem
} from '@mini-game-workflow/game-core-types';
import type { AdLogRepository } from '../../db/repositories/ad-log.repository.js';
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

  constructor(
    gameUserRepository: GameUserRepository,
    gameConfigRepository: GameConfigRepository,
    noticeRepository: NoticeRepository,
    adLogRepository: AdLogRepository,
    rewardLogRepository: RewardLogRepository,
    analyticsEventRepository: AnalyticsEventRepository
  ) {
    this.gameUserRepository = gameUserRepository;
    this.gameConfigRepository = gameConfigRepository;
    this.noticeRepository = noticeRepository;
    this.adLogRepository = adLogRepository;
    this.rewardLogRepository = rewardLogRepository;
    this.analyticsEventRepository = analyticsEventRepository;
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
      status: record.status,
      updatedAt: record.updatedAt
    }));

    return ok(this.wrapList(items));
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

  private wrapList<TItem>(items: TItem[]): AdminListResult<TItem> {
    return {
      items,
      total: items.length
    };
  }
}
