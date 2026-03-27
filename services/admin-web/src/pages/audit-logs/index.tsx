import { formatTimestamp, stringifyValue } from '../../app/format.js';
import type { AdminPageLoaderContext, AdminPageModel, AdminTableAction } from '../../app/types.js';
import { fetchAuditLogs } from '../../services/audit-logs.js';

export async function AuditLogsPage(context: AdminPageLoaderContext): Promise<AdminPageModel> {
  const adminUserId =
    typeof context.query?.adminUserId === 'number'
      ? context.query.adminUserId
      : typeof context.query?.adminUserId === 'string'
        ? Number(context.query.adminUserId)
        : undefined;
  const action = typeof context.query?.action === 'string' ? context.query.action : undefined;
  const targetType = typeof context.query?.targetType === 'string' ? context.query.targetType : undefined;
  const targetKey = typeof context.query?.targetKey === 'string' ? context.query.targetKey : undefined;
  const auditLogs = await fetchAuditLogs({
    gameKey: context.gameKey,
    adminUserId: Number.isFinite(adminUserId) ? adminUserId : undefined,
    action,
    targetType,
    targetKey
  });

  return {
    path: '/audit-logs',
    title: '审计日志',
    description: '查看后台关键写操作是谁做的、改了什么对象，以及发生在什么时候。',
    filters: [
      {
        key: 'gameKey',
        label: 'Game',
        value: context.gameKey
      },
      {
        key: 'adminUserId',
        label: '管理员',
        value: stringifyValue(adminUserId) || 'all'
      },
      {
        key: 'action',
        label: '动作',
        value: stringifyValue(action) || 'all'
      },
      {
        key: 'targetType',
        label: '对象类型',
        value: stringifyValue(targetType) || 'all'
      },
      {
        key: 'targetKey',
        label: '对象键',
        value: stringifyValue(targetKey) || 'all'
      }
    ],
    forms: [
      {
        kind: 'query',
        title: '筛选审计日志',
        description: '按管理员、动作、对象类型和对象键定位某次后台写操作。',
        submitLabel: '应用筛选',
        fields: [
          {
            key: 'gameKey',
            label: 'Game Key',
            type: 'hidden',
            value: context.gameKey
          },
          {
            key: 'adminUserId',
            label: '管理员 ID',
            type: 'text',
            value: Number.isFinite(adminUserId) ? String(adminUserId) : '',
            placeholder: '例如 1'
          },
          {
            key: 'action',
            label: '动作',
            type: 'text',
            value: action ?? '',
            placeholder: '例如 config.publish'
          },
          {
            key: 'targetType',
            label: '对象类型',
            type: 'text',
            value: targetType ?? '',
            placeholder: '例如 game_config'
          },
          {
            key: 'targetKey',
            label: '对象键',
            type: 'text',
            value: targetKey ?? '',
            placeholder: '例如 game_sample:web:seed-web-v1'
          }
        ]
      }
    ],
    table: {
      title: '后台写操作审计',
      description: '每条记录都来自 admin_audit_log，可回溯配置和公告的关键变更。',
      columns: [
        { key: 'createdAt', label: '时间' },
        { key: 'adminUsername', label: '管理员' },
        { key: 'roleCode', label: '角色' },
        { key: 'action', label: '动作' },
        { key: 'targetType', label: '对象类型' },
        { key: 'targetKey', label: '对象键' },
        { key: 'detail', label: '详情' }
      ],
      rows: auditLogs.items.map((log) => {
        const actions: AdminTableAction[] = [];

        if (log.targetType === 'game_config') {
          const query: Record<string, string> = {};

          if (typeof log.detail.platform === 'string') {
            query.platform = log.detail.platform;
          }

          actions.push({
            label: '看配置页',
            path: '/configs',
            query
          });
        } else if (log.targetType === 'notice') {
          actions.push({
            label: '看公告页',
            path: '/notices'
          });
        }

        return {
          id: String(log.id),
          values: {
            createdAt: formatTimestamp(log.createdAt),
            adminUsername: `${log.adminUsername} (#${log.adminUserId})`,
            roleCode: log.roleCode,
            action: log.action,
            targetType: log.targetType,
            targetKey: log.targetKey,
            detail: JSON.stringify(log.detail)
          },
          actions: actions.length > 0 ? actions : undefined
        };
      }),
      emptyText: '当前筛选条件下没有审计日志。'
    },
    notes: [
      {
        title: '审计用途',
        lines: [
          '首期只审计关键写操作，不审计普通只读查询。',
          'targetKey 应能把一条变更稳定定位到某个配置版本或某条公告。'
        ]
      }
    ]
  };
}
