import type { ConfigManager, ConfigSource } from './ConfigManager.js';
import type { RemoteConfigRequestContext } from '@mini-game-workflow/game-core-types';

export function createConfigManager<TConfig>(): ConfigManager<TConfig> {
  let source: ConfigSource<TConfig> | null = null;
  let value: TConfig | null = null;
  let version = 'local';

  return {
    async init(nextSource: ConfigSource<TConfig>): Promise<void> {
      source = nextSource;
      const local = await source.loadLocal();
      value = local;
    },
    getAll(): Readonly<TConfig> {
      if (!value) {
        throw new Error('ConfigManager has not been initialized.');
      }

      return value;
    },
    get<TValue>(selector: (config: TConfig) => TValue): TValue {
      if (!value) {
        throw new Error('ConfigManager has not been initialized.');
      }

      return selector(value);
    },
    getVersion(): string {
      return version;
    },
    async refresh(context?: RemoteConfigRequestContext): Promise<void> {
      if (!source || !value || !source.loadRemote || !context) {
        return;
      }

      const remote = await source.loadRemote(context);
      value = source.merge(value, remote.payload);
      version = remote.configVersion;
    }
  };
}
