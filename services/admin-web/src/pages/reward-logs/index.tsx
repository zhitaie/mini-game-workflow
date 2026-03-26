import { formatTimestamp, stringifyValue } from '../../app/format.js';
import type { AdminPageLoaderContext, AdminPageModel } from '../../app/types.js';
import { fetchRewardLogs } from '../../services/reward-logs.js';

export async function RewardLogsPage(context: AdminPageLoaderContext): Promise<AdminPageModel> {
  const gameUserId =
    typeof context.query?.gameUserId === 'number'
      ? context.query.gameUserId
      : typeof context.query?.gameUserId === 'string'
        ? Number(context.query.gameUserId)
        : undefined;
  const logs = await fetchRewardLogs({
    gameKey: context.gameKey,
    gameUserId: Number.isFinite(gameUserId) ? gameUserId : undefined,
    rewardType: typeof context.query?.rewardType === 'string' ? context.query.rewardType : undefined,
    reason: typeof context.query?.reason === 'string' ? context.query.reason : undefined,
    bizId: typeof context.query?.bizId === 'string' ? context.query.bizId : undefined
  });

  return {
    path: '/reward-logs',
    title: '奖励日志',
    description: '用于定位奖励幂等、发奖结果与 balance_after。',
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
      title: '奖励发放记录',
      description: 'bizId 应能和广告校验记录串起来。',
      columns: [
        { key: 'bizId', label: '业务号' },
        { key: 'rewardType', label: '奖励类型' },
        { key: 'amount', label: '数量' },
        { key: 'reason', label: '原因' },
        { key: 'status', label: '状态' },
        { key: 'balanceAfter', label: '发奖后余额' },
        { key: 'createdAt', label: '创建时间' }
      ],
      rows: logs.items.map((log) => ({
        id: log.bizId,
        values: {
          bizId: log.bizId,
          rewardType: log.rewardType,
          amount: String(log.amount),
          reason: log.reason,
          status: log.status,
          balanceAfter: String(log.balanceAfter),
          createdAt: formatTimestamp(log.createdAt)
        },
        actions: [
          {
            label: '回看广告校验',
            path: '/ad-logs',
            query: {
              gameUserId: log.gameUserId
            }
          }
        ]
      })),
      emptyText: '当前筛选条件下没有奖励记录。'
    }
  };
}
