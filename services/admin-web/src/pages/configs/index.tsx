import { formatTimestamp, stringifyValue } from '../../app/format.js';
import type { AdminPageLoaderContext, AdminPageModel } from '../../app/types.js';
import { fetchConfigs } from '../../services/configs.js';

function prettyJson(value: Record<string, unknown>): string {
  return JSON.stringify(value, null, 2);
}

function summarizeJson(value: Record<string, unknown>): string {
  const raw = JSON.stringify(value);
  return raw.length > 72 ? `${raw.slice(0, 69)}...` : raw;
}

export async function ConfigsPage(context: AdminPageLoaderContext): Promise<AdminPageModel> {
  const platform = typeof context.query?.platform === 'string' ? context.query.platform : undefined;
  const status =
    context.query?.status === 'draft' || context.query?.status === 'active' || context.query?.status === 'archived'
      ? context.query.status
      : undefined;
  const configs = await fetchConfigs({
    gameKey: context.gameKey,
    platform,
    status
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
        value: stringifyValue(platform) || 'all'
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
        title: '筛选配置',
        description: '按平台和状态查看当前配置版本分布。',
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
            key: 'status',
            label: '状态',
            type: 'select',
            value: status ?? '',
            options: [
              { label: 'all', value: '' },
              { label: 'draft', value: 'draft' },
              { label: 'active', value: 'active' },
              { label: 'archived', value: 'archived' }
            ]
          }
        ]
      },
      {
        kind: 'mutation',
        title: '保存草稿配置',
        description: '先保存 draft，再通过列表动作发布为 active。允许多个 active 并存，但客户端版本窗口不能重叠。',
        action: 'config.saveDraft',
        submitLabel: '保存草稿',
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
            value: platform ?? 'web',
            required: true
          },
          {
            key: 'configVersion',
            label: '配置版本',
            type: 'text',
            placeholder: '例如 web-v2',
            required: true
          },
          {
            key: 'minClientVersion',
            label: '最小客户端版本',
            type: 'text',
            placeholder: '例如 0.2.0'
          },
          {
            key: 'maxClientVersion',
            label: '最大客户端版本',
            type: 'text',
            placeholder: '例如 0.9.99'
          },
          {
            key: 'payloadJson',
            label: 'Payload JSON',
            type: 'textarea',
            rows: 8,
            required: true,
            value: prettyJson({
              ad: {
                enabled: true
              }
            })
          }
        ]
      }
    ],
    table: {
      title: '配置版本',
      description: '草稿和已发布版本都在这里查看。active 可以并存，但版本窗口必须互不重叠。',
      columns: [
        { key: 'platform', label: '平台' },
        { key: 'configVersion', label: '配置版本' },
        { key: 'status', label: '状态' },
        { key: 'payload', label: '配置摘要' },
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
          payload: summarizeJson(config.payload),
          minClientVersion: config.minClientVersion ?? '-',
          maxClientVersion: config.maxClientVersion ?? '-',
          updatedAt: formatTimestamp(config.updatedAt)
        },
        actions:
          config.status === 'draft'
            ? [
                {
                  label: '看审计',
                  path: '/audit-logs',
                  query: {
                    targetType: 'game_config',
                    targetKey: `${config.gameKey}:${config.platform}:${config.configVersion}`
                  }
                },
                {
                  kind: 'submit',
                  label: '发布',
                  action: 'config.publish',
                  tone: 'primary',
                  confirmText: '确认发布这个配置版本？如果它和已有 active 版本的客户端范围重叠，服务端会拒绝。',
                  payload: {
                    gameKey: config.gameKey,
                    platform: config.platform,
                    configVersion: config.configVersion
                  }
                }
              ]
            : config.status === 'active'
              ? [
                  {
                    label: '看审计',
                    path: '/audit-logs',
                    query: {
                      targetType: 'game_config',
                      targetKey: `${config.gameKey}:${config.platform}:${config.configVersion}`
                    }
                  },
                  {
                    kind: 'submit',
                    label: '归档',
                    action: 'config.archive',
                    tone: 'danger',
                    confirmText: '确认归档这个 active 配置版本？归档后对应客户端范围将不再下发该配置。',
                    payload: {
                      gameKey: config.gameKey,
                      platform: config.platform,
                      configVersion: config.configVersion
                    }
                  }
                ]
            : [
                {
                  label: '看审计',
                  path: '/audit-logs',
                  query: {
                    targetType: 'game_config',
                    targetKey: `${config.gameKey}:${config.platform}:${config.configVersion}`
                  }
                }
              ]
      })),
      emptyText: '当前筛选条件下没有配置记录。'
    },
    notes: [
      {
        title: '页面约束',
        lines: [
          '配置页必须区分 draft / active / archived。',
          '配置页只能操作远程运行配置，不能覆盖接入声明。',
          'active 版本一旦发布，不允许直接改写成 draft；如需调整，应新建版本。',
          '多个 active 可以并存，但同一 gameKey + platform 下客户端版本窗口不能重叠。'
        ]
      }
    ]
  };
}
