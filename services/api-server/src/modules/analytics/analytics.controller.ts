import { AnalyticsService } from './analytics.service.js';

export function createAnalyticsController(service: AnalyticsService): AnalyticsService {
  return service;
}
