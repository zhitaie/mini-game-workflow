import { formatTimestamp, stringifyValue } from '../../app/format.js';
import type { AdminPageLoaderContext, AdminPageModel } from '../../app/types.js';
import { fetchAnalyticsEvents } from '../../services/analytics.js';

export async function AnalyticsPage(context: AdminPageLoaderContext): Promise<AdminPageModel> {
  const gameUserId =
    typeof context.query?.gameUserId === 'number'
      ? context.query.gameUserId
      : typeof context.query?.gameUserId === 'string'
        ? Number(context.query.gameUserId)
        : undefined;
  const eventName = typeof context.query?.eventName === 'string' ? context.query.eventName : undefined;
  const events = await fetchAnalyticsEvents({
    gameKey: context.gameKey,
    gameUserId: Number.isFinite(gameUserId) ? gameUserId : undefined,
    eventName
  });

  return {
    path: '/analytics',
    title: '埋点查询',
    description: '首期只做轻量查询壳，不做重图表。',
    filters: [
      {
        key: 'gameKey',
        label: 'Game',
        value: context.gameKey
      },
      {
        key: 'gameUserId',
        label: 'User',
        value: stringifyValue(gameUserId) || 'all'
      },
      {
        key: 'eventName',
        label: '事件名',
        value: stringifyValue(eventName) || 'all'
      }
    ],
    forms: [
      {
        kind: 'query',
        title: '筛选埋点',
        description: '按用户或事件名确认埋点是否真正写入。',
        submitLabel: '应用筛选',
        fields: [
          {
            key: 'gameKey',
            label: 'Game Key',
            type: 'hidden',
            value: context.gameKey
          },
          {
            key: 'gameUserId',
            label: '用户 ID',
            type: 'text',
            value: Number.isFinite(gameUserId) ? String(gameUserId) : '',
            placeholder: '例如 1'
          },
          {
            key: 'eventName',
            label: '事件名',
            type: 'text',
            value: eventName ?? '',
            placeholder: '例如 app_launch'
          }
        ]
      }
    ],
    table: {
      title: '埋点事件',
      description: '查看某个事件是否真的写进 analytics_event。',
      columns: [
        { key: 'eventName', label: '事件名' },
        { key: 'gameUserId', label: '用户' },
        { key: 'clientTime', label: '客户端时间' },
        { key: 'createdAt', label: '写入时间' },
        { key: 'eventData', label: '事件数据' }
      ],
      rows: events.items.map((event, index) => ({
        id: `${event.eventName}:${index}`,
        values: {
          eventName: event.eventName,
          gameUserId: event.gameUserId === null ? '-' : String(event.gameUserId),
          clientTime: formatTimestamp(event.clientTime),
          createdAt: formatTimestamp(event.createdAt),
          eventData: JSON.stringify(event.eventData)
        },
        actions:
          event.gameUserId === null
            ? undefined
            : [
                {
                  label: '看该用户广告日志',
                  path: '/ad-logs',
                  query: {
                    gameUserId: event.gameUserId
                  }
                },
                {
                  label: '看该用户奖励日志',
                  path: '/reward-logs',
                  query: {
                    gameUserId: event.gameUserId
                  }
                }
              ]
      })),
      emptyText: '当前筛选条件下没有埋点记录。'
    }
  };
}
