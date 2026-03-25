export interface AdminListResult<TItem> {
  items: TItem[];
  total: number;
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
