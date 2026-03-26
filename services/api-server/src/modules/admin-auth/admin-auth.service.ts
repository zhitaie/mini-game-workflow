import { ok } from '../../common/response.js';
import { createAdminSessionToken, getAdminSessionExpiresAt, verifyPassword } from '../../common/admin.js';
import type { AdminSessionRepository } from '../../db/repositories/admin-session.repository.js';
import type { AdminUserRepository } from '../../db/repositories/admin-user.repository.js';

export class AdminAuthService {
  private readonly adminUserRepository: AdminUserRepository;
  private readonly adminSessionRepository: AdminSessionRepository;

  constructor(adminUserRepository: AdminUserRepository, adminSessionRepository: AdminSessionRepository) {
    this.adminUserRepository = adminUserRepository;
    this.adminSessionRepository = adminSessionRepository;
  }

  login(input: {
    username: string;
    password: string;
  }) {
    const user = this.adminUserRepository.findByUsername(input.username);

    if (!user || user.status !== 'active' || !verifyPassword(input.password, user.passwordHash)) {
      return null;
    }

    const token = createAdminSessionToken();
    const expiresAt = getAdminSessionExpiresAt();
    this.adminSessionRepository.create({
      adminUserId: user.id,
      token,
      expiresAt
    });

    return ok({
      session: {
        token,
        expiresAt
      },
      adminUser: {
        id: user.id,
        username: user.username,
        displayName: user.displayName,
        roleCode: user.roleCode,
        roleName: user.roleName,
        permissions: user.permissions
      }
    });
  }

  getSession(token: string) {
    const session = this.adminSessionRepository.findByToken(token);

    if (!session) {
      return null;
    }

    this.adminSessionRepository.touch(session.id);
    return session;
  }

  getMe(token: string) {
    const session = this.getSession(token);

    if (!session) {
      return null;
    }

    return ok({
      session: {
        expiresAt: session.expiresAt
      },
      adminUser: {
        id: session.adminUserId,
        username: session.username,
        displayName: session.displayName,
        roleCode: session.roleCode,
        roleName: session.roleName,
        permissions: session.permissions
      }
    });
  }

  logout(token: string) {
    return ok({
      revoked: this.adminSessionRepository.revokeByToken(token)
    });
  }
}
