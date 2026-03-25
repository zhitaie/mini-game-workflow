import { NoticeService } from './notice.service.js';

export function createNoticeController(service: NoticeService): NoticeService {
  return service;
}
