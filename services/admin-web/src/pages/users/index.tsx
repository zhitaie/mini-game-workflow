import { formatTimestamp, stringifyValue } from '../../app/format.js';
import type { AdminPageLoaderContext, AdminPageModel } from '../../app/types.js';
import { fetchUsers } from '../../services/users.js';

export async function UsersPage(context: AdminPageLoaderContext): Promise<AdminPageModel> {
  const platform = typeof context.query?.platform === 'string' ? context.query.platform : undefined;
  const platformOpenId = typeof context.query?.platformOpenId === 'string' ? context.query.platformOpenId : undefined;
  const status = context.query?.status === 'active' ? 'active' : undefined;
  const users = await fetchUsers({
    gameKey: context.gameKey,
    platform,
    platformOpenId,
    status
  });

  return {
    path: '/users',
    title: '用户查询',
    description: '按 gameKey、平台和平台身份查看游戏用户记录。',
    filters: [
      {
        key: 'gameKey',
        label: 'Game',
        value: context.gameKey
      },
      {
        key: 'platform',
        label: 'Platform',
        value: stringifyValue(platform) || 'all'
      },
      {
        key: 'platformOpenId',
        label: '平台身份',
        value: stringifyValue(platformOpenId) || 'all'
      },
      {
        key: 'status',
        label: '状态',
        value: stringifyValue(status) || 'all'
      }
    ],
    forms: [
      {
        kind: 'query',
        title: '筛选用户',
        description: '按平台、平台身份和状态缩小用户范围。',
        submitLabel: '应用筛选',
        fields: [
          {
            key: 'gameKey',
            label: 'Game Key',
            type: 'hidden',
            value: context.gameKey
          },
          {
            key: 'platform',
            label: '平台',
            type: 'text',
            value: platform ?? '',
            placeholder: '例如 web'
          },
          {
            key: 'platformOpenId',
            label: '平台身份',
            type: 'text',
            value: platformOpenId ?? '',
            placeholder: '例如 web:web-mock-login-code'
          },
          {
            key: 'status',
            label: '状态',
            type: 'select',
            value: status ?? '',
            options: [
              { label: 'all', value: '' },
              { label: 'active', value: 'active' }
            ]
          }
        ]
      }
    ],
    table: {
      title: '用户列表',
      description: '页面侧不直写数据库，只通过 admin 查询接口拉取结果。',
      columns: [
        { key: 'id', label: 'ID' },
        { key: 'platform', label: '平台' },
        { key: 'platformOpenId', label: '平台身份' },
        { key: 'nickname', label: '昵称' },
        { key: 'status', label: '状态' },
        { key: 'lastLoginAt', label: '最近登录' }
      ],
      rows: users.items.map((user) => ({
        id: String(user.id),
        values: {
          id: String(user.id),
          platform: user.platform,
          platformOpenId: user.platformOpenId,
          nickname: user.nickname || '-',
          status: user.status,
          lastLoginAt: formatTimestamp(user.lastLoginAt)
        },
        actions: [
          {
            label: '看广告日志',
            path: '/ad-logs',
            query: {
              gameUserId: user.id
            }
          },
          {
            label: '看奖励日志',
            path: '/reward-logs',
            query: {
              gameUserId: user.id
            }
          },
          {
            label: '看埋点',
            path: '/analytics',
            query: {
              gameUserId: user.id
            }
          }
        ]
      })),
      emptyText: '当前筛选条件下没有用户记录。'
    }
  };
}
