import { ok } from '../../common/response';

export class SaveService {
  getSave() {
    return ok({
      save: {
        schemaVersion: 1,
        data: {
          coins: 0,
          level: 1
        },
        updatedAt: Date.now()
      }
    });
  }
}

