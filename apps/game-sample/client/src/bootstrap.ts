import {
  type CoreRuntime,
  WebMockPlatformAdapter,
  createConfigManager,
  createCoreRuntime,
  createNetworkManager,
  createSaveManager,
  createAnalyticsManager,
  createAdManager
} from '@mini-game-workflow/game-core-client';
import type { ConfigEnvelope, RemoteConfigRequestContext, SaveDefinition } from '@mini-game-workflow/game-core-types';
import gameConfig from '../../game.config.js';
import { GameApp } from './game/GameApp.js';

type SampleSave = {
  coins: number;
  level: number;
};

type SampleConfig = {
  ad: {
    enabled: boolean;
  };
};

const saveDefinition: SaveDefinition<SampleSave> = {
  schemaVersion: 1,
  createDefaultData: () => ({
    coins: 0,
    level: 1
  }),
  migrate: (stored) => stored
};

const localConfig: SampleConfig = {
  ad: {
    enabled: true
  }
};

interface LoginResponse {
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
    data: SampleSave;
    updatedAt: number;
  } | null;
}

export interface BootstrapGameSampleOptions {
  baseURL?: string;
  fetchImpl?: typeof fetch;
}

export interface BootstrapGameSampleResult {
  runtime: CoreRuntime<SampleConfig, SampleSave>;
  session: LoginResponse;
}

export async function bootstrapGameSample(options: BootstrapGameSampleOptions = {}): Promise<BootstrapGameSampleResult> {
  const platform = new WebMockPlatformAdapter();
  const network = createNetworkManager();
  const config = createConfigManager<SampleConfig>();
  const save = createSaveManager(saveDefinition);
  const analytics = createAnalyticsManager();
  const ad = createAdManager(platform);
  let token: string | undefined;

  network.init({
    baseURL: options.baseURL ?? 'http://localhost:3000',
    gameKey: gameConfig.gameKey,
    platform: platform.getPlatform(),
    clientVersion: '0.1.0',
    getToken: () => token,
    fetchImpl: options.fetchImpl
  });

  await config.init({
    loadLocal: async () => localConfig,
    loadRemote: async (context: RemoteConfigRequestContext) =>
      network.request<ConfigEnvelope<SampleConfig>>({
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
      ...remote
    })
  });

  await save.init();
  const loginCode = await platform.login();
  const session = await network.request<LoginResponse>({
    path: '/api/auth/login',
    method: 'POST',
    body: {
      gameKey: gameConfig.gameKey,
      platform: platform.getPlatform(),
      code: loginCode.code,
      clientVersion: '0.1.0'
    }
  });
  token = session.token;

  await config.refresh({
    gameKey: gameConfig.gameKey,
    platform: platform.getPlatform(),
    clientVersion: '0.1.0'
  });

  const remoteSave = await network.request<RemoteSaveResponse>({
    path: '/api/save',
    method: 'GET',
    requiresAuth: true
  });

  if (remoteSave.save) {
    await save.replace(remoteSave.save.data);
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
    gameKey: gameConfig.gameKey,
    platform: platform.getPlatform(),
    clientVersion: '0.1.0',
    sessionId: 'local-session',
    gameUserId: session.user.id
  });

  const runtime = createCoreRuntime({
    gameConfig,
    platform,
    network,
    config,
    save,
    analytics,
    ad
  });

  const app = new GameApp(runtime);
  await app.start();

  return {
    runtime,
    session
  };
}
