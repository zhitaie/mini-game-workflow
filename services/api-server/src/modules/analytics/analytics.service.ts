import { ok } from '../../common/response.js';
import type { AuthClaims } from '../../common/auth.js';
import type { AnalyticsEventRepository } from '../../db/repositories/analytics-event.repository.js';

export interface AnalyticsEventInput {
  eventName: string;
  eventData?: Record<string, unknown>;
  clientTime?: number;
}

export interface AnalyticsInput {
  gameKey: string;
  platform: string;
  clientVersion: string;
  sessionId: string;
  events: AnalyticsEventInput[];
}

export class AnalyticsService {
  private readonly analyticsEventRepository: AnalyticsEventRepository;

  constructor(analyticsEventRepository: AnalyticsEventRepository) {
    this.analyticsEventRepository = analyticsEventRepository;
  }

  accept(input: AnalyticsInput, claims: AuthClaims | null) {
    if (claims && claims.gameKey !== input.gameKey) {
      throw new Error(`Token game mismatch: ${claims.gameKey} !== ${input.gameKey}`);
    }

    const effectiveGameKey = claims?.gameKey ?? input.gameKey;

    this.analyticsEventRepository.append(
      input.events.map((event) => ({
        gameKey: effectiveGameKey,
        gameUserId: claims?.gameUserId ?? null,
        eventName: event.eventName,
        eventData: event.eventData ?? {},
        clientTime: event.clientTime ?? Date.now(),
        createdAt: Date.now()
      }))
    );

    return ok({
      acceptedCount: input.events.length
    });
  }
}
