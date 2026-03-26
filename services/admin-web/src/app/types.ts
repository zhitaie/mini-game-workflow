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
  kind?: 'link';
  label: string;
  path: AdminRoutePath;
  query?: Record<string, string | number | boolean>;
}

export interface AdminSubmitAction {
  kind: 'submit';
  label: string;
  action: 'config.saveDraft' | 'config.publish' | 'notice.save' | 'notice.setStatus';
  payload?: Record<string, string | number | boolean>;
  confirmText?: string;
  tone?: 'default' | 'primary' | 'danger';
}

export type AdminTableAction = AdminLinkAction | AdminSubmitAction;

export interface AdminTableColumn {
  key: string;
  label: string;
}

export interface AdminTableRow {
  id: string;
  values: Record<string, string>;
  actions?: AdminTableAction[];
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

export interface AdminFormFieldOption {
  label: string;
  value: string;
}

export interface AdminFormField {
  key: string;
  label: string;
  type: 'text' | 'textarea' | 'select' | 'hidden' | 'datetime-local';
  value?: string;
  placeholder?: string;
  required?: boolean;
  rows?: number;
  options?: AdminFormFieldOption[];
}

export interface AdminMutationFormSection {
  kind: 'mutation';
  title: string;
  description: string;
  action: AdminSubmitAction['action'];
  submitLabel: string;
  fields: AdminFormField[];
}

export interface AdminQueryFormSection {
  kind: 'query';
  title: string;
  description: string;
  route?: AdminRoutePath;
  submitLabel: string;
  resetLabel?: string;
  fields: AdminFormField[];
}

export type AdminFormSection = AdminMutationFormSection | AdminQueryFormSection;

export interface AdminBanner {
  tone: 'success' | 'error';
  message: string;
}

export interface AdminPageModel {
  path: AdminRoutePath;
  title: string;
  description: string;
  filters: AdminFilterChip[];
  banner?: AdminBanner;
  metrics?: AdminMetricCard[];
  forms?: AdminFormSection[];
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
  currentQuery?: Record<string, string | number | boolean | undefined>;
  navigation: AdminNavItem[];
  page: AdminPageModel;
}

export interface AdminRenderTarget {
  innerHTML: string;
}

export interface AdminRenderResult {
  snapshot: AdminAppSnapshot;
  html: string;
}
