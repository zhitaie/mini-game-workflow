import type { CoreRuntime } from '@mini-game-workflow/game-core-client';
import type { SkiEndlessConfig, SkiMapKey, SkiModeKey } from '../config/SkiEndlessConfig';
import type { SkiEndlessSaveData } from '../data/SkiEndlessSave';

interface AdVerificationResponse {
  verified: boolean;
  verificationId: string;
  sceneKey: string;
  completed: boolean;
}

interface RewardClaimResponse {
  bizId: string;
  rewardType: string;
  amount: number;
  balanceAfter: number;
  status: string;
}

export interface SkiLeaderboardEntry {
  rank: number;
  gameUserId: number;
  nickname: string;
  bestDistance: number;
  bestScore: number;
}

interface SkiLeaderboardResponse {
  gameKey: string;
  metric: 'best_distance';
  items: SkiLeaderboardEntry[];
  currentUser: SkiLeaderboardEntry | null;
}

export interface SkiNoticeItem {
  id: number;
  title: string;
  content: string;
  status: string;
  startTime: number | null;
  endTime: number | null;
  updatedAt: number;
}

interface SkiNoticeListResponse {
  gameKey: string;
  items: SkiNoticeItem[];
}

export interface SkiRunStartInput {
  mode?: SkiModeKey;
  map?: SkiMapKey;
}

export interface SkiRunFinishInput {
  distance: number;
  coinsCollected: number;
  crashedBy?: string;
}

export interface SkiRunSummary {
  distance: number;
  score: number;
  coinsCollected: number;
  bestDistance: number;
  bestScore: number;
  selectedMode: SkiModeKey;
  selectedMap: SkiMapKey;
}

export class SkiEndlessPrototypeController {
  private readonly runtime: CoreRuntime<SkiEndlessConfig, SkiEndlessSaveData>;

  constructor(runtime: CoreRuntime<SkiEndlessConfig, SkiEndlessSaveData>) {
    this.runtime = runtime;
  }

  startRun(input: SkiRunStartInput = {}): {
    mode: SkiModeKey;
    map: SkiMapKey;
    baseSpeed: number;
    maxSpeed: number;
    obstacleDensity: number;
  } {
    const config = this.runtime.config.getAll();
    const mode = input.mode ?? config.rotation.defaultMode;
    const map = input.map ?? config.rotation.defaultMap;

    this.runtime.analytics.track({
      eventName: 'ski_run_start',
      eventData: {
        mode,
        map
      }
    });

    return {
      mode,
      map,
      baseSpeed: config.gameplay.baseSpeed,
      maxSpeed: config.gameplay.maxSpeed,
      obstacleDensity: config.gameplay.obstacleDensity
    };
  }

  async finishRun(input: SkiRunFinishInput): Promise<SkiRunSummary> {
    const config = this.runtime.config.getAll();
    const current = this.runtime.save.getAll();
    const score = Math.floor(input.distance * config.gameplay.scorePerMeter);
    const nextData: SkiEndlessSaveData = {
      ...current.data,
      coins: current.data.coins + input.coinsCollected,
      bestDistance: Math.max(current.data.bestDistance, input.distance),
      bestScore: Math.max(current.data.bestScore, score)
    };

    await this.runtime.save.replace(nextData);
    await this.persistSave();

    this.runtime.analytics.track({
      eventName: 'ski_run_finish',
      eventData: {
        distance: input.distance,
        score,
        coinsCollected: input.coinsCollected,
        crashedBy: input.crashedBy ?? null
      }
    });
    await this.runtime.analytics.flush();

    return {
      distance: input.distance,
      score,
      coinsCollected: input.coinsCollected,
      bestDistance: nextData.bestDistance,
      bestScore: nextData.bestScore,
      selectedMode: nextData.selectedMode,
      selectedMap: nextData.selectedMap
    };
  }

  async requestRevive(): Promise<AdVerificationResponse> {
    const adResult = await this.runtime.ad.showRewardedVideo('ski_revive');

    return this.runtime.network.request<AdVerificationResponse>({
      path: '/api/ad/verify',
      method: 'POST',
      requiresAuth: true,
      body: {
        sceneKey: adResult.sceneKey,
        adType: adResult.adType,
        platformResult: {
          completed: adResult.completed
        }
      }
    });
  }

  async claimDoubleCoinReward(baseCoins: number): Promise<RewardClaimResponse> {
    const adResult = await this.runtime.ad.showRewardedVideo('ski_double_coin');
    const verification = await this.runtime.network.request<AdVerificationResponse>({
      path: '/api/ad/verify',
      method: 'POST',
      requiresAuth: true,
      body: {
        sceneKey: adResult.sceneKey,
        adType: adResult.adType,
        platformResult: {
          completed: adResult.completed
        }
      }
    });

    return this.runtime.network.request<RewardClaimResponse>({
      path: '/api/reward/claim',
      method: 'POST',
      requiresAuth: true,
      body: {
        rewardType: 'gold',
        amount: baseCoins,
        reason: 'reward_ad',
        bizId: verification.verificationId
      }
    });
  }

  getSnapshot(): {
    configVersion: string;
    coins: number;
    bestDistance: number;
    bestScore: number;
    selectedMode: SkiModeKey;
    selectedMap: SkiMapKey;
  } {
    const save = this.runtime.save.getAll();

    return {
      configVersion: this.runtime.config.getVersion(),
      coins: save.data.coins,
      bestDistance: save.data.bestDistance,
      bestScore: save.data.bestScore,
      selectedMode: save.data.selectedMode,
      selectedMap: save.data.selectedMap
    };
  }

  async getLeaderboard(limit = 8): Promise<SkiLeaderboardResponse> {
    return this.runtime.network.request<SkiLeaderboardResponse>({
      path: '/api/rank',
      method: 'GET',
      requiresAuth: true,
      query: {
        gameKey: this.runtime.gameConfig.gameKey,
        limit
      }
    });
  }

  async getNotices(): Promise<SkiNoticeListResponse> {
    return this.runtime.network.request<SkiNoticeListResponse>({
      path: '/api/notice',
      method: 'GET',
      query: {
        gameKey: this.runtime.gameConfig.gameKey
      }
    });
  }

  private async persistSave(): Promise<void> {
    const current = this.runtime.save.getAll();

    await this.runtime.network.request({
      path: '/api/save',
      method: 'POST',
      requiresAuth: true,
      body: {
        save: {
          schemaVersion: current.schemaVersion,
          data: current.data
        }
      }
    });
  }
}
