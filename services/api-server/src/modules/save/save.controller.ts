import { SaveService } from './save.service.js';

export function createSaveController(service: SaveService): SaveService {
  return service;
}
