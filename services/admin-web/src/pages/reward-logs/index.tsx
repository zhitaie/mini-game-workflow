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
  const rewardType = typeof context.query?.rewardType === 'string' ? context.query.rewardType : undefined;
  const reason = typeof context.query?.reason === 'string' ? context.query.reason : undefined;
  const bizId = typeof context.query?.bizId === 'string' ? context.query.bizId : undefined;
  const logs = await fetchRewardLogs({
    gameKey: context.gameKey,
    gameUserId: Number.isFinite(gameUserId) ? gameUserId : undefined,
    rewardType,
    reason,
    bizId
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
      },
      {
        key: 'rewardType',
        label: '奖励类型',
        value: stringifyValue(rewardType) || 'all'
      },
      {
        key: 'reason',
        label: '原因',
        value: stringifyValue(reason) || 'all'
      },
      {
        key: 'bizId',
        label: '业务号',
        value: stringifyValue(bizId) || 'all'
      }
    ],
    forms: [
      {
        kind: 'query',
        title: '筛选奖励日志',
        description: '按用户、奖励类型、原因和业务号缩小范围。',
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
            key: 'rewardType',
            label: '奖励类型',
            type: 'text',
            value: rewardType ?? '',
            placeholder: '例如 gold'
          },
          {
            key: 'reason',
            label: '原因',
            type: 'text',
            value: reason ?? '',
            placeholder: '例如 reward_ad'
          },
          {
            key: 'bizId',
            label: '业务号',
            type: 'text',
            value: bizId ?? '',
            placeholder: '例如 verify-xxx'
          }
        ]
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
      emptyText: '当前筛选条件下没有奖励记录。'
    }
  };
}
