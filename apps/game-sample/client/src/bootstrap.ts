import {
  WebMockPlatformAdapter,
  createConfigManager,
  createCoreRuntime,
  createNetworkManager,
  createSaveManager,
  createAnalyticsManager,
  createAdManager
} from '@mini-game-workflow/game-core-client';
import type { ConfigEnvelope, SaveDefinition } from '@mini-game-workflow/game-core-types';
import gameConfig from '../../game.config';
import { GameApp } from './game/GameApp';

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

async function loadRemoteConfig(): Promise<ConfigEnvelope<SampleConfig>> {
  return {
    configVersion: 'local-dev',
    gameKey: gameConfig.gameKey,
    payload: {},
    updatedAt: Date.now()
  };
}

export async function bootstrapGameSample(): Promise<void> {
  const platform = new WebMockPlatformAdapter();
  const network = createNetworkManager();
  const config = createConfigManager<SampleConfig>();
  const save = createSaveManager(saveDefinition);
  const analytics = createAnalyticsManager();
  const ad = createAdManager(platform);

  network.init({
    baseURL: 'http://localhost:3000',
    gameKey: gameConfig.gameKey,
    platform: platform.getPlatform(),
    clientVersion: '0.1.0'
  });

  await config.init({
    loadLocal: async () => localConfig,
    loadRemote: async () => loadRemoteConfig(),
    merge: (local, remote) => ({
      ...local,
      ...remote
    })
  });

  await save.init();
  analytics.init({
    gameKey: gameConfig.gameKey,
    platform: platform.getPlatform(),
    clientVersion: '0.1.0',
    sessionId: 'local-session'
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
}

