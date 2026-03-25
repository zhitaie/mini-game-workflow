import type { AnalyticsContext, AnalyticsEventInput } from '@mini-game-workflow/game-core-types';
import type { AnalyticsManager } from './AnalyticsManager.js';
import type { NetworkManager } from '../network/NetworkManager.js';

export function createAnalyticsManager(network: NetworkManager): AnalyticsManager {
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

      if (queue.length === 0) {
        return;
      }

      const payload = queue.splice(0, queue.length);
      await network.request({
        path: '/api/analytics/events',
        method: 'POST',
        requiresAuth: true,
        body: {
          gameKey: context.gameKey,
          platform: context.platform,
          clientVersion: context.clientVersion,
          sessionId: context.sessionId,
          events: payload
        }
      });

    }
  };
}
