import { ok } from '../../common/response';

export class NoticeService {
  list(gameKey: string) {
    return ok({
      gameKey,
      items: []
    });
  }
}

