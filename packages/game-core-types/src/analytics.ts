export interface AnalyticsContext {
  gameKey: string;
  platform: string;
  clientVersion: string;
  sessionId: string;
  gameUserId?: number;
}

export interface AnalyticsEventInput {
  eventName: string;
  eventData?: Record<string, unknown>;
  clientTime?: number;
}

