import { AdService } from './ad.service.js';

export function createAdController(service: AdService): AdService {
  return service;
}
