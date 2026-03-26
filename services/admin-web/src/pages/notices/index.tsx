import { formatTimestamp } from '../../app/format.js';
import type { AdminPageLoaderContext, AdminPageModel } from '../../app/types.js';
import { fetchNotices } from '../../services/notices.js';

export async function NoticesPage(context: AdminPageLoaderContext): Promise<AdminPageModel> {
  const notices = await fetchNotices({
    gameKey: context.gameKey,
    status:
      context.query?.status === 'draft' || context.query?.status === 'active' || context.query?.status === 'archived'
        ? context.query.status
        : undefined
  });

  return {
    path: '/notices',
    title: '公告管理',
    description: '按 gameKey 查询公告状态与生效时间窗口。',
    filters: [
      {
        key: 'gameKey',
        label: 'Game',
        value: context.gameKey
      }
    ],
    table: {
      title: '公告列表',
      description: '当前先提供查询壳，后续再增加创建和编辑动作。',
      columns: [
        { key: 'title', label: '标题' },
        { key: 'status', label: '状态' },
        { key: 'startTime', label: '开始时间' },
        { key: 'endTime', label: '结束时间' },
        { key: 'updatedAt', label: '更新时间' }
      ],
      rows: notices.items.map((notice) => ({
        id: String(notice.id),
        values: {
          title: notice.title,
          status: notice.status,
          startTime: formatTimestamp(notice.startTime),
          endTime: formatTimestamp(notice.endTime),
          updatedAt: formatTimestamp(notice.updatedAt)
        }
      })),
      emptyText: '当前筛选条件下没有公告记录。'
    }
  };
}
