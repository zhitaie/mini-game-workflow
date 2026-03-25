import type { AnalyticsContext, AnalyticsEventInput } from '@mini-game-workflow/game-core-types';

export interface AnalyticsManager {
  init(context: AnalyticsContext): void;
  setUserContext(gameUserId: number): void;
  track(event: AnalyticsEventInput): void;
  flush(): Promise<void>;
}
