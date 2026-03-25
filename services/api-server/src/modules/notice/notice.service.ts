import { ok } from '../../common/response.js';
import type { NoticeRepository } from '../../db/repositories/notice.repository.js';

export class NoticeService {
  private readonly noticeRepository: NoticeRepository;

  constructor(noticeRepository: NoticeRepository) {
    this.noticeRepository = noticeRepository;
  }

  list(gameKey: string) {
    return ok({
      gameKey,
      items: this.noticeRepository.listActive(gameKey).map((record) => ({
        id: record.id,
        title: record.title,
        content: record.content,
        status: record.status,
        startTime: record.startTime,
        endTime: record.endTime,
        updatedAt: record.updatedAt
      }))
    });
  }
}
