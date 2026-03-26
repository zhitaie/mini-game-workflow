import { formatTimestamp, stringifyValue } from '../../app/format.js';
import type { AdminPageLoaderContext, AdminPageModel } from '../../app/types.js';
import { fetchAdLogs } from '../../services/ad-logs.js';

function parseBooleanFilter(value: string | number | boolean | undefined): boolean | undefined {
  if (value === true || value === 'true') {
    return true;
  }

  if (value === false || value === 'false') {
    return false;
  }

  return undefined;
}

export async function AdLogsPage(context: AdminPageLoaderContext): Promise<AdminPageModel> {
  const gameUserId =
    typeof context.query?.gameUserId === 'number'
      ? context.query.gameUserId
      : typeof context.query?.gameUserId === 'string'
        ? Number(context.query.gameUserId)
        : undefined;
  const sceneKey = typeof context.query?.sceneKey === 'string' ? context.query.sceneKey : undefined;
  const verified = parseBooleanFilter(context.query?.verified);
  const completed = parseBooleanFilter(context.query?.completed);
  const logs = await fetchAdLogs({
    gameKey: context.gameKey,
    gameUserId: Number.isFinite(gameUserId) ? gameUserId : undefined,
    sceneKey,
    verified,
    completed
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
      },
      {
        key: 'sceneKey',
        label: '场景',
        value: stringifyValue(sceneKey) || 'all'
      },
      {
        key: 'verified',
        label: '已校验',
        value: stringifyValue(verified) || 'all'
      },
      {
        key: 'completed',
        label: '已完成',
        value: stringifyValue(completed) || 'all'
      }
    ],
    forms: [
      {
        kind: 'query',
        title: '筛选广告日志',
        description: '按用户、场景和校验状态快速定位广告问题。',
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
            key: 'sceneKey',
            label: '场景',
            type: 'text',
            value: sceneKey ?? '',
            placeholder: '例如 doubleCoinReward'
          },
          {
            key: 'verified',
            label: '已校验',
            type: 'select',
            value: stringifyValue(verified),
            options: [
              { label: 'all', value: '' },
              { label: 'true', value: 'true' },
              { label: 'false', value: 'false' }
            ]
          },
          {
            key: 'completed',
            label: '已完成',
            type: 'select',
            value: stringifyValue(completed),
            options: [
              { label: 'all', value: '' },
              { label: 'true', value: 'true' },
              { label: 'false', value: 'false' }
            ]
          }
        ]
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
        },
        actions: [
          {
            label: '看该用户奖励',
            path: '/reward-logs',
            query: {
              gameUserId: log.gameUserId
            }
          },
          {
            label: '看该用户埋点',
            path: '/analytics',
            query: {
              gameUserId: log.gameUserId
            }
          }
        ]
      })),
      emptyText: '当前筛选条件下没有广告校验记录。'
    }
  };
}
