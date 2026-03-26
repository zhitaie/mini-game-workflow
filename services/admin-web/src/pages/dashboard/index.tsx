import { fetchDashboardSummary } from '../../services/dashboard.js';
import type { AdminPageLoaderContext, AdminPageModel } from '../../app/types.js';

export async function DashboardPage(context: AdminPageLoaderContext): Promise<AdminPageModel> {
  const summary = await fetchDashboardSummary(context.gameKey);

  return {
    path: '/dashboard',
    title: '仪表盘',
    description: '按 gameKey 查看当前游戏的基础运营总览。',
    filters: [
      {
        key: 'gameKey',
        label: 'Game',
        value: context.gameKey
      }
    ],
    metrics: [
      {
        key: 'todayNewUsers',
        label: '当日新增用户',
        value: String(summary.todayNewUsers)
      },
      {
        key: 'todayLoginUsers',
        label: '当日登录用户',
        value: String(summary.todayLoginUsers)
      },
      {
        key: 'adVerifyCount',
        label: '广告校验次数',
        value: String(summary.adVerifyCount)
      },
      {
        key: 'rewardCount',
        label: '奖励发放次数',
        value: String(summary.rewardCount)
      },
      {
        key: 'analyticsEventCount',
        label: '埋点上报次数',
        value: String(summary.analyticsEventCount)
      }
    ],
    notes: [
      {
        title: '当前判断',
        lines: [
          '首期仪表盘只保留轻量指标，不做重型图表。',
          '所有指标都已经通过服务端 admin 查询接口返回，而不是页面自行拼接。'
        ]
      }
    ]
  };
}
