import type { GameConfig } from '@mini-game-workflow/game-core-types';
import type { PlatformAdapter } from '../platform/PlatformAdapter';
import type { NetworkManager } from '../network/NetworkManager';
import type { ConfigManager } from '../config/ConfigManager';
import type { SaveManager } from '../save/SaveManager';
import type { AnalyticsManager } from '../analytics/AnalyticsManager';
import type { AdManager } from '../ad/AdManager';

export interface CoreRuntime<TConfig = unknown, TSave = unknown> {
  gameConfig: GameConfig;
  platform: PlatformAdapter;
  network: NetworkManager;
  config: ConfigManager<TConfig>;
  save: SaveManager<TSave>;
  analytics: AnalyticsManager;
  ad: AdManager;
}

export interface CreateCoreRuntimeOptions<TConfig = unknown, TSave = unknown> {
  gameConfig: GameConfig;
  platform: PlatformAdapter;
  network: NetworkManager;
  config: ConfigManager<TConfig>;
  save: SaveManager<TSave>;
  analytics: AnalyticsManager;
  ad: AdManager;
}

export function createCoreRuntime<TConfig = unknown, TSave = unknown>(
  options: CreateCoreRuntimeOptions<TConfig, TSave>
): CoreRuntime<TConfig, TSave> {
  return options;
}
