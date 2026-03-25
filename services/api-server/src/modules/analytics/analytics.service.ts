import { ok } from '../../common/response.js';

export class AnalyticsService {
  accept(events: unknown[]) {
    return ok({
      acceptedCount: events.length
    });
  }
}
