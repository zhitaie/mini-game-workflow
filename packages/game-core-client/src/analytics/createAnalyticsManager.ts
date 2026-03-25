import type { AnalyticsContext, AnalyticsEventInput } from '@mini-game-workflow/game-core-types';
import type { AnalyticsManager } from './AnalyticsManager';

export function createAnalyticsManager(): AnalyticsManager {
  let context: AnalyticsContext | null = null;
  const queue: AnalyticsEventInput[] = [];

  return {
    init(nextContext: AnalyticsContext): void {
      context = nextContext;
    },
    setUserContext(gameUserId: number): void {
      if (!context) {
        throw new Error('AnalyticsManager has not been initialized.');
      }

      context = {
        ...context,
        gameUserId
      };
    },
    track(event: AnalyticsEventInput): void {
      queue.push({
        ...event,
        clientTime: event.clientTime ?? Date.now()
      });
    },
    async flush(): Promise<void> {
      if (!context) {
        throw new Error('AnalyticsManager has not been initialized.');
      }

      queue.length = 0;
    }
  };
}

