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
  const events = await fetchAnalyticsEvents({
    gameKey: context.gameKey,
    gameUserId: Number.isFinite(gameUserId) ? gameUserId : undefined,
    eventName: typeof context.query?.eventName === 'string' ? context.query.eventName : undefined
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
        }
      })),
      emptyText: '当前筛选条件下没有埋点记录。'
    }
  };
}
