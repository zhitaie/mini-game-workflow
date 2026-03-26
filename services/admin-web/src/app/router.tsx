import { AdLogsPage } from '../pages/ad-logs/index.js';
import { AnalyticsPage } from '../pages/analytics/index.js';
import { ConfigsPage } from '../pages/configs/index.js';
import { DashboardPage } from '../pages/dashboard/index.js';
import { NoticesPage } from '../pages/notices/index.js';
import { RewardLogsPage } from '../pages/reward-logs/index.js';
import { UsersPage } from '../pages/users/index.js';
import type { AdminRouteDefinition, AdminRoutePath } from './types.js';

export const adminRoutes: AdminRouteDefinition[] = [
  {
    path: '/dashboard',
    label: '仪表盘',
    description: '查看当前游戏的核心轻量指标。',
    load: DashboardPage
  },
  {
    path: '/users',
    label: '用户查询',
    description: '按 gameKey 和平台身份查询 game_user。',
    load: UsersPage
  },
  {
    path: '/configs',
    label: '配置管理',
    description: '查看远程配置版本和状态。',
    load: ConfigsPage
  },
  {
    path: '/notices',
    label: '公告管理',
    description: '查看当前游戏的公告记录。',
    load: NoticesPage
  },
  {
    path: '/ad-logs',
    label: '广告日志',
    description: '查看广告校验记录。',
    load: AdLogsPage
  },
  {
    path: '/reward-logs',
    label: '奖励日志',
    description: '查看奖励幂等与发奖结果。',
    load: RewardLogsPage
  },
  {
    path: '/analytics',
    label: '埋点查询',
    description: '查看 analytics_event 轻量结果。',
    load: AnalyticsPage
  }
];

export function resolveAdminRoute(path: AdminRoutePath): AdminRouteDefinition {
  return adminRoutes.find((route) => route.path === path) ?? adminRoutes[0];
}
