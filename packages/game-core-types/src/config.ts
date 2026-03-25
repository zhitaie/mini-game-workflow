export interface ConfigEnvelope<TConfig> {
  configVersion: string;
  gameKey: string;
  minClientVersion?: string;
  maxClientVersion?: string;
  payload: Partial<TConfig>;
  updatedAt: number;
}

export interface RemoteConfigRequestContext {
  gameKey: string;
  platform: string;
  clientVersion: string;
}

