import { AuthService } from './auth.service.js';

export function createAuthController(service: AuthService): AuthService {
  return service;
}
