import { formatTimestamp } from '../../app/format.js';
import type { AdminPageLoaderContext, AdminPageModel } from '../../app/types.js';
import { fetchNotices } from '../../services/notices.js';

function toDatetimeLocalValue(value: number | null): string {
  if (value === null) {
    return '';
  }

  const date = new Date(value);
  const offset = date.getTimezoneOffset() * 60_000;
  return new Date(date.getTime() - offset).toISOString().slice(0, 16);
}

export async function NoticesPage(context: AdminPageLoaderContext): Promise<AdminPageModel> {
  const notices = await fetchNotices({
    gameKey: context.gameKey,
    status:
      context.query?.status === 'draft' || context.query?.status === 'active' || context.query?.status === 'archived'
        ? context.query.status
        : undefined
  });
  const editingNoticeId =
    typeof context.query?.editNoticeId === 'string' && context.query.editNoticeId
      ? Number(context.query.editNoticeId)
      : undefined;
  const editingNotice = Number.isFinite(editingNoticeId)
    ? notices.items.find((notice) => notice.id === editingNoticeId)
    : undefined;

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
    forms: [
      {
        title: editingNotice ? `编辑公告 #${editingNotice.id}` : '创建公告',
        description: editingNotice ? '修改已存在公告的内容、状态和生效时间。' : '新公告默认建议先保存为 draft，再切换状态。 ',
        action: 'notice.save',
        submitLabel: editingNotice ? '保存修改' : '创建公告',
        fields: [
          {
            key: 'id',
            label: 'Notice ID',
            type: 'hidden',
            value: editingNotice ? String(editingNotice.id) : ''
          },
          {
            key: 'gameKey',
            label: 'Game Key',
            type: 'hidden',
            value: context.gameKey
          },
          {
            key: 'title',
            label: '标题',
            type: 'text',
            required: true,
            value: editingNotice?.title ?? ''
          },
          {
            key: 'content',
            label: '内容',
            type: 'textarea',
            rows: 6,
            required: true,
            value: editingNotice?.content ?? ''
          },
          {
            key: 'status',
            label: '状态',
            type: 'select',
            value: editingNotice?.status ?? 'draft',
            options: [
              { label: 'draft', value: 'draft' },
              { label: 'active', value: 'active' },
              { label: 'archived', value: 'archived' }
            ]
          },
          {
            key: 'startTime',
            label: '开始时间',
            type: 'text',
            placeholder: '2026-03-26T09:00',
            value: editingNotice ? toDatetimeLocalValue(editingNotice.startTime) : ''
          },
          {
            key: 'endTime',
            label: '结束时间',
            type: 'text',
            placeholder: '2026-03-30T23:59',
            value: editingNotice ? toDatetimeLocalValue(editingNotice.endTime) : ''
          }
        ]
      }
    ],
    table: {
      title: '公告列表',
      description: '支持创建、编辑和状态切换；客户端只读取 active 且处于时间窗口内的公告。',
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
        },
        actions: [
          {
            label: '编辑',
            path: '/notices',
            query: {
              editNoticeId: notice.id
            }
          },
          ...(notice.status !== 'active'
            ? [
                {
                  kind: 'submit' as const,
                  label: '设为 active',
                  action: 'notice.setStatus' as const,
                  tone: 'primary' as const,
                  payload: {
                    id: notice.id,
                    status: 'active'
                  }
                }
              ]
            : []),
          ...(notice.status !== 'archived'
            ? [
                {
                  kind: 'submit' as const,
                  label: '归档',
                  action: 'notice.setStatus' as const,
                  tone: 'danger' as const,
                  payload: {
                    id: notice.id,
                    status: 'archived'
                  }
                }
              ]
            : [])
        ]
      })),
      emptyText: '当前筛选条件下没有公告记录。'
    },
    notes: [
      {
        title: '公告规则',
        lines: [
          '公告是否对玩家可见，除了状态是 active，还取决于 startTime / endTime 时间窗口。',
          '编辑页通过 hash 中的 editNoticeId 载入，不额外引入单条详情接口。'
        ]
      }
    ]
  };
}
