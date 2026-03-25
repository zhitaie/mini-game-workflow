export interface PlatformLoginResult {
  code: string;
}

export interface PlatformAdHandle {
  show(): Promise<boolean>;
}

export interface PlatformAdCapability {
  createRewardedVideo(sceneKey: string): Promise<PlatformAdHandle>;
}

export interface PlatformAdapter {
  getPlatform(): string;
  login(): Promise<PlatformLoginResult>;
  ad?: PlatformAdCapability;
}

