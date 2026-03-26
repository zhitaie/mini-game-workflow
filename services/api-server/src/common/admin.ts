import { createHmac, timingSafeEqual } from 'node:crypto';
import type { AdminGrantedPermission, AdminPermissionCode } from '@mini-game-workflow/game-core-types';

export type AdminRoleCode = 'super_admin' | 'operator' | 'viewer';

export interface AdminRoleSeed {
  code: AdminRoleCode;
  name: string;
  permissions: AdminGrantedPermission[];
}

export interface AdminUserSeed {
  username: string;
  password: string;
  displayName: string;
  roleCode: AdminRoleCode;
}

export interface AdminActor {
  sessionId: number;
  adminUserId: number;
  username: string;
  displayName: string;
  roleCode: string;
  roleName: string;
  permissions: AdminGrantedPermission[];
  expiresAt: number;
}

export const ADMIN_PERMISSION_CODES: AdminPermissionCode[] = [
  'dashboard.read',
  'users.read',
  'configs.read',
  'configs.write',
  'configs.publish',
  'notices.read',
  'notices.write',
  'logs.read',
  'audit.read'
];

export const DEFAULT_ADMIN_ROLES: AdminRoleSeed[] = [
  {
    code: 'super_admin',
    name: 'Super Admin',
    permissions: ['*']
  },
  {
    code: 'operator',
    name: 'Operator',
    permissions: ['dashboard.read', 'users.read', 'configs.read', 'configs.write', 'notices.read', 'notices.write', 'logs.read', 'audit.read']
  },
  {
    code: 'viewer',
    name: 'Viewer',
    permissions: ['dashboard.read', 'users.read', 'configs.read', 'notices.read', 'logs.read', 'audit.read']
  }
];

export const DEFAULT_ADMIN_USERS: AdminUserSeed[] = [
  {
    username: 'admin',
    password: 'dev-admin-password',
    displayName: 'Development Admin',
    roleCode: 'super_admin'
  },
  {
    username: 'operator',
    password: 'dev-operator-password',
    displayName: 'Development Operator',
    roleCode: 'operator'
  },
  {
    username: 'viewer',
    password: 'dev-viewer-password',
    displayName: 'Development Viewer',
    roleCode: 'viewer'
  }
];

const ADMIN_SESSION_TTL_MS = Number(process.env.MINI_GAME_WORKFLOW_ADMIN_SESSION_TTL_MS ?? 1000 * 60 * 60 * 24 * 7);
const ADMIN_PASSWORD_SECRET = process.env.MINI_GAME_WORKFLOW_ADMIN_PASSWORD_SECRET ?? 'mini-game-workflow-admin-password-secret';
const ADMIN_SESSION_SECRET = process.env.MINI_GAME_WORKFLOW_ADMIN_SESSION_SECRET ?? 'mini-game-workflow-admin-session-secret';

function randomToken(size: number): string {
  if (globalThis.crypto?.getRandomValues) {
    const bytes = new Uint8Array(size);
    globalThis.crypto.getRandomValues(bytes);
    return Array.from(bytes, (value) => value.toString(16).padStart(2, '0')).join('');
  }

  const chunks: string[] = [];
  while (chunks.join('').length < size * 2) {
    chunks.push(Math.random().toString(36).slice(2));
  }

  return chunks.join('').slice(0, size * 2);
}

function derivePasswordHash(password: string, salt: string): string {
  return createHmac('sha256', `${ADMIN_PASSWORD_SECRET}:${salt}`).update(password).digest('base64url');
}

export function createPasswordHash(password: string): string {
  const salt = randomToken(16);
  const derived = derivePasswordHash(password, salt);
  return `${salt}:${derived}`;
}

export function verifyPassword(password: string, passwordHash: string): boolean {
  const [salt = '', storedHash = ''] = passwordHash.split(':');

  if (!salt || !storedHash) {
    return false;
  }

  const actual = Buffer.from(derivePasswordHash(password, salt));
  const expected = Buffer.from(storedHash);
  return actual.length === expected.length && timingSafeEqual(actual, expected);
}

export function createAdminSessionToken(): string {
  return randomToken(32);
}

export function hashAdminSessionToken(token: string): string {
  return createHmac('sha256', ADMIN_SESSION_SECRET).update(token).digest('base64url');
}

export function hasAdminPermission(grantedPermissions: AdminGrantedPermission[], permission: AdminPermissionCode): boolean {
  return grantedPermissions.includes('*') || grantedPermissions.includes(permission);
}

export function getAdminSessionExpiresAt(now = Date.now()): number {
  return now + ADMIN_SESSION_TTL_MS;
}
