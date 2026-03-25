import { ok } from '../../common/response';

export class AnalyticsService {
  accept(events: unknown[]) {
    return ok({
      acceptedCount: events.length
    });
  }
}

