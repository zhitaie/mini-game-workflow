export interface AdminListResult<TItem> {
  items: TItem[];
  total: number;
}

export interface AdminItemResult<TItem> {
  item: TItem;
}

export type AdminPermissionCode =
  | 'dashboard.read'
  | 'users.read'
  | 'configs.read'
  | 'configs.write'
  | 'configs.publish'
  | 'notices.read'
  | 'notices.write'
  | 'logs.read'
  | 'audit.read';

export type AdminGrantedPermission = AdminPermissionCode | '*';

export interface AdminAuthUser {
  id: number;
  username: string;
  displayName: string;
  roleCode: string;
  roleName: string;
  permissions: AdminGrantedPermission[];
}

export interface AdminSessionInfo {
  token: string;
  expiresAt: number;
}

export interface AdminAuthLoginResult {
  session: AdminSessionInfo;
  adminUser: AdminAuthUser;
}

export interface AdminAuthMeResult {
  session: {
    expiresAt: number;
  };
  adminUser: AdminAuthUser;
}

export interface AdminDashboardSummary {
  gameKey: string;
  totalUsers: number;
  todayNewUsers: number;
  todayLoginUsers: number;
  adVerifyCount: number;
  rewardCount: number;
  analyticsEventCount: number;
}

export interface AdminGameUserItem {
  id: number;
  gameKey: string;
  platform: string;
  platformOpenId: string;
  nickname: string;
  avatar: string;
  status: 'active';
  createdAt: number;
  lastLoginAt: number;
}

export interface AdminConfigItem {
  gameKey: string;
  platform: string;
  configVersion: string;
  minClientVersion?: string;
  maxClientVersion?: string;
  payload: Record<string, unknown>;
  status: 'draft' | 'active' | 'archived';
  updatedAt: number;
}

export interface AdminNoticeItem {
  id: number;
  gameKey: string;
  title: string;
  content: string;
  status: 'draft' | 'active' | 'archived';
  startTime: number | null;
  endTime: number | null;
  updatedAt: number;
}

export interface AdminAdLogItem {
  gameKey: string;
  gameUserId: number;
  sceneKey: string;
  adType: string;
  clientTraceId: string | null;
  verificationId: string;
  verified: boolean;
  completed: boolean;
  errorCode: string | null;
  createdAt: number;
}

export interface AdminRewardLogItem {
  gameKey: string;
  gameUserId: number;
  rewardType: string;
  amount: number;
  reason: string;
  bizId: string;
  status: 'success';
  balanceAfter: number;
  createdAt: number;
}

export interface AdminAnalyticsEventItem {
  gameKey: string;
  gameUserId: number | null;
  eventName: string;
  eventData: Record<string, unknown>;
  clientTime: number;
  createdAt: number;
}

export interface AdminAuditLogItem {
  id: number;
  adminUserId: number;
  adminUsername: string;
  roleCode: string;
  action: string;
  targetType: string;
  targetKey: string;
  gameKey: string | null;
  detail: Record<string, unknown>;
  createdAt: number;
}
