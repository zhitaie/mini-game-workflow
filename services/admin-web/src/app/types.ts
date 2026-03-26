export type AdminRoutePath =
  | '/dashboard'
  | '/users'
  | '/configs'
  | '/notices'
  | '/ad-logs'
  | '/reward-logs'
  | '/analytics';

export interface AdminNavItem {
  path: AdminRoutePath;
  label: string;
  description: string;
}

export interface AdminFilterChip {
  key: string;
  label: string;
  value: string;
}

export interface AdminMetricCard {
  key: string;
  label: string;
  value: string;
}

export interface AdminLinkAction {
  label: string;
  path: AdminRoutePath;
  query?: Record<string, string | number | boolean>;
}

export interface AdminTableColumn {
  key: string;
  label: string;
}

export interface AdminTableRow {
  id: string;
  values: Record<string, string>;
  actions?: AdminLinkAction[];
}

export interface AdminTableSection {
  title: string;
  description: string;
  columns: AdminTableColumn[];
  rows: AdminTableRow[];
  emptyText: string;
}

export interface AdminNoteBlock {
  title: string;
  lines: string[];
}

export interface AdminPageModel {
  path: AdminRoutePath;
  title: string;
  description: string;
  filters: AdminFilterChip[];
  metrics?: AdminMetricCard[];
  table?: AdminTableSection;
  notes?: AdminNoteBlock[];
}

export interface AdminPageLoaderContext {
  gameKey: string;
  query?: Record<string, string | number | boolean | undefined>;
}

export interface AdminRouteDefinition {
  path: AdminRoutePath;
  label: string;
  description: string;
  load(context: AdminPageLoaderContext): Promise<AdminPageModel>;
}

export interface AdminAppSnapshot {
  gameKey: string;
  currentRoute: AdminRoutePath;
  navigation: AdminNavItem[];
  page: AdminPageModel;
}
