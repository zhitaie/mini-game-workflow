export type AdType = 'rewardedVideo' | 'banner';

export interface AdResult {
  completed: boolean;
  sceneKey: string;
  adType: AdType;
  clientTraceId?: string;
}

