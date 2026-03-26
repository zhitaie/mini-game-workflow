import { formatTimestamp, stringifyValue } from '../../app/format.js';
import type { AdminPageLoaderContext, AdminPageModel } from '../../app/types.js';
import { fetchAdLogs } from '../../services/ad-logs.js';

export async function AdLogsPage(context: AdminPageLoaderContext): Promise<AdminPageModel> {
  const gameUserId =
    typeof context.query?.gameUserId === 'number'
      ? context.query.gameUserId
      : typeof context.query?.gameUserId === 'string'
        ? Number(context.query.gameUserId)
        : undefined;
  const logs = await fetchAdLogs({
    gameKey: context.gameKey,
    gameUserId: Number.isFinite(gameUserId) ? gameUserId : undefined,
    sceneKey: typeof context.query?.sceneKey === 'string' ? context.query.sceneKey : undefined,
    verified: typeof context.query?.verified === 'boolean' ? context.query.verified : undefined,
    completed: typeof context.query?.completed === 'boolean' ? context.query.completed : undefined
  });

  return {
    path: '/ad-logs',
    title: '广告日志',
    description: '用于定位广告校验是否成功、是否完整观看，以及具体场景表现。',
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
      title: '广告校验记录',
      description: '查询结果直接来自 ad_log admin 接口。',
      columns: [
        { key: 'verificationId', label: '校验号' },
        { key: 'sceneKey', label: '场景' },
        { key: 'adType', label: '广告类型' },
        { key: 'verified', label: '已校验' },
        { key: 'completed', label: '已完成' },
        { key: 'errorCode', label: '错误码' },
        { key: 'createdAt', label: '创建时间' }
      ],
      rows: logs.items.map((log) => ({
        id: log.verificationId,
        values: {
          verificationId: log.verificationId,
          sceneKey: log.sceneKey,
          adType: log.adType,
          verified: String(log.verified),
          completed: String(log.completed),
          errorCode: log.errorCode ?? '-',
          createdAt: formatTimestamp(log.createdAt)
        }
      })),
      emptyText: '当前筛选条件下没有广告校验记录。'
    }
  };
}
