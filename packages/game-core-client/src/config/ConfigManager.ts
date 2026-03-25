import type { ConfigEnvelope, RemoteConfigRequestContext } from '@mini-game-workflow/game-core-types';

export interface ConfigSource<TConfig> {
  loadLocal(): Promise<TConfig>;
  loadRemote?(context: RemoteConfigRequestContext): Promise<ConfigEnvelope<TConfig>>;
  merge(local: TConfig, remote?: Partial<TConfig>): TConfig;
}

export interface ConfigManager<TConfig> {
  init(source: ConfigSource<TConfig>): Promise<void>;
  getAll(): Readonly<TConfig>;
  get<TValue>(selector: (config: TConfig) => TValue): TValue;
  getVersion(): string;
  refresh(context?: RemoteConfigRequestContext): Promise<void>;
}

