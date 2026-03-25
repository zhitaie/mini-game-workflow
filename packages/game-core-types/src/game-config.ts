export interface FeatureFlags {
  save?: boolean;
  config?: boolean;
  analytics?: boolean;
  ads?: boolean;
}

export interface GameConfig {
  gameKey: string;
  displayName: string;
  targets: string[];
  features: FeatureFlags;
  namespaces: {
    save: string;
    config: string;
  };
}

