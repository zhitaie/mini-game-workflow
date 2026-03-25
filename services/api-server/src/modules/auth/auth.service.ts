import { ok } from '../../common/response';

export class AuthService {
  login(gameKey: string) {
    return ok({
      token: `${gameKey}:mock-token`,
      user: {
        id: 1,
        gameKey,
        platform: 'web',
        nickname: '',
        avatar: '',
        status: 'active'
      },
      isNewUser: true
    });
  }
}

