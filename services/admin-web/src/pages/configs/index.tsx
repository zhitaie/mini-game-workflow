import { formatTimestamp, stringifyValue } from '../../app/format.js';
import type { AdminPageLoaderContext, AdminPageModel } from '../../app/types.js';
import { fetchConfigs } from '../../services/configs.js';

export async function ConfigsPage(context: AdminPageLoaderContext): Promise<AdminPageModel> {
  const configs = await fetchConfigs({
    gameKey: context.gameKey,
    platform: typeof context.query?.platform === 'string' ? context.query.platform : undefined,
    status:
      context.query?.status === 'draft' || context.query?.status === 'active' || context.query?.status === 'archived'
        ? context.query.status
        : undefined
  });

  return {
    path: '/configs',
    title: '配置管理',
    description: '只管理远程运行配置，不触碰 game.config.ts 里的接入声明。',
    filters: [
      {
        key: 'gameKey',
        label: 'Game',
        value: context.gameKey
      },
      {
        key: 'platform',
        label: 'Platform',
        value: stringifyValue(typeof context.query?.platform === 'string' ? context.query.platform : undefined) || 'all'
      }
    ],
    table: {
      title: '配置版本',
      description: '当前先做查询壳，后续再往发布动作延展。',
      columns: [
        { key: 'platform', label: '平台' },
        { key: 'configVersion', label: '配置版本' },
        { key: 'status', label: '状态' },
        { key: 'minClientVersion', label: '最小客户端版本' },
        { key: 'maxClientVersion', label: '最大客户端版本' },
        { key: 'updatedAt', label: '更新时间' }
      ],
      rows: configs.items.map((config) => ({
        id: `${config.platform}:${config.configVersion}`,
        values: {
          platform: config.platform,
          configVersion: config.configVersion,
          status: config.status,
          minClientVersion: config.minClientVersion ?? '-',
          maxClientVersion: config.maxClientVersion ?? '-',
          updatedAt: formatTimestamp(config.updatedAt)
        }
      })),
      emptyText: '当前筛选条件下没有配置记录。'
    },
    notes: [
      {
        title: '页面约束',
        lines: [
          '配置页必须区分 draft / active / archived。',
          '配置页只能操作远程运行配置，不能覆盖接入声明。'
        ]
      }
    ]
  };
}
