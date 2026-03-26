import type { AdminAuthLoginResult, AdminAuthMeResult } from '@mini-game-workflow/game-core-types';
import { request } from './api-client.js';

export interface LoginAdminInput {
  username: string;
  password: string;
}

export async function loginAdmin(input: LoginAdminInput): Promise<AdminAuthLoginResult> {
  return request<AdminAuthLoginResult>('/api/admin/auth/login', {
    method: 'POST',
    body: input,
    requiresAuth: false
  });
}

export async function fetchAdminMe(): Promise<AdminAuthMeResult> {
  return request<AdminAuthMeResult>('/api/admin/auth/me');
}

export async function logoutAdmin(): Promise<{ revoked: boolean }> {
  return request<{ revoked: boolean }>('/api/admin/auth/logout', {
    method: 'POST'
  });
}
