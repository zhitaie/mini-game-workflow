import {
  type CoreRuntime,
  WebMockPlatformAdapter,
  createAdManager,
  createAnalyticsManager,
  createConfigManager,
  createCoreRuntime,
  createNetworkManager,
  createSaveManager
} from '@mini-game-workflow/game-core-client';
import type { ConfigEnvelope, RemoteConfigRequestContext } from '@mini-game-workflow/game-core-types';
import { skiEndlessGameConfig } from '../app/SkiEndlessGameConfig';
import { localSkiEndlessConfig, type SkiEndlessConfig } from '../config/SkiEndlessConfig';
import { skiEndlessSaveDefinition, type SkiEndlessSaveData } from '../data/SkiEndlessSave';

export interface LoginResponse {
  token: string;
  user: {
    id: number;
    gameKey: string;
    platform: string;
    nickname: string;
    avatar: string;
    status: string;
  };
  isNewUser: boolean;
}

interface RemoteSaveResponse {
  save: {
    schemaVersion: number;
    data: SkiEndlessSaveData;
    updatedAt: number;
  } | null;
}

export interface BootstrapSkiEndlessRuntimeOptions {
  baseURL?: string;
  fetchImpl?: typeof fetch;
  clientVersion?: string;
}

export interface BootstrapSkiEndlessRuntimeResult {
  runtime: CoreRuntime<SkiEndlessConfig, SkiEndlessSaveData>;
  session: LoginResponse;
}

export async function bootstrapSkiEndlessRuntime(
  options: BootstrapSkiEndlessRuntimeOptions = {}
): Promise<BootstrapSkiEndlessRuntimeResult> {
  const platform = new WebMockPlatformAdapter();
  const network = createNetworkManager();
  const config = createConfigManager<SkiEndlessConfig>();
  const save = createSaveManager(skiEndlessSaveDefinition);
  const clientVersion = options.clientVersion ?? '0.1.0';
  let token: string | undefined;

  network.init({
    baseURL: options.baseURL ?? 'http://127.0.0.1:3000',
    gameKey: skiEndlessGameConfig.gameKey,
    platform: platform.getPlatform(),
    clientVersion,
    getToken: () => token,
    fetchImpl: options.fetchImpl
  });

  const analytics = createAnalyticsManager(network);
  const ad = createAdManager(platform);

  await config.init({
    loadLocal: async () => localSkiEndlessConfig,
    loadRemote: async (context: RemoteConfigRequestContext) =>
      network.request<ConfigEnvelope<SkiEndlessConfig>>({
        path: '/api/config',
        method: 'GET',
        query: {
          gameKey: context.gameKey,
          platform: context.platform,
          clientVersion: context.clientVersion
        }
      }),
    merge: (local, remote) => ({
      ...local,
      ...remote,
      gameplay: {
        ...local.gameplay,
        ...remote?.gameplay
      },
      rewardAd: {
        ...local.rewardAd,
        ...remote?.rewardAd
      },
      rotation: {
        ...local.rotation,
        ...remote?.rotation,
        availableModes: remote?.rotation?.availableModes ?? local.rotation.availableModes,
        availableMaps: remote?.rotation?.availableMaps ?? local.rotation.availableMaps
      }
    })
  });

  await save.init();

  const loginCode = await platform.login();
  const session = await network.request<LoginResponse>({
    path: '/api/auth/login',
    method: 'POST',
    body: {
      gameKey: skiEndlessGameConfig.gameKey,
      platform: platform.getPlatform(),
      code: loginCode.code,
      clientVersion
    }
  });
  token = session.token;

  await config.refresh({
    gameKey: skiEndlessGameConfig.gameKey,
    platform: platform.getPlatform(),
    clientVersion
  });

  const remoteSave = await network.request<RemoteSaveResponse>({
    path: '/api/save',
    method: 'GET',
    requiresAuth: true
  });

  if (remoteSave.save) {
    await save.restore(remoteSave.save);
  } else {
    const current = save.getAll();
    await network.request<RemoteSaveResponse>({
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

  analytics.init({
    gameKey: skiEndlessGameConfig.gameKey,
    platform: platform.getPlatform(),
    clientVersion,
    sessionId: `ski-boot-${Date.now()}`,
    gameUserId: session.user.id
  });

  analytics.track({
    eventName: 'ski_boot_ready',
    eventData: {
      gameKey: skiEndlessGameConfig.gameKey
    }
  });
  await analytics.flush();

  return {
    runtime: createCoreRuntime({
      gameConfig: skiEndlessGameConfig,
      platform,
      network,
      config,
      save,
      analytics,
      ad
    }),
    session
  };
}
