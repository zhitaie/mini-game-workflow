import { ok } from '../../common/response.js';

export class NoticeService {
  list(gameKey: string) {
    return ok({
      gameKey,
      items: []
    });
  }
}
