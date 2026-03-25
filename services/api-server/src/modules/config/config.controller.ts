import { ConfigService } from './config.service.js';

export function createConfigController(service: ConfigService): ConfigService {
  return service;
}
