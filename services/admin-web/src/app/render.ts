import { stringifyValue } from './format.js';
import type {
  AdminAppSnapshot,
  AdminFilterChip,
  AdminLinkAction,
  AdminMetricCard,
  AdminNoteBlock,
  AdminRenderTarget,
  AdminTableSection
} from './types.js';

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function buildQueryString(query: Record<string, string | number | boolean | undefined>): string {
  const params = new URLSearchParams();
  Object.entries(query).forEach(([key, value]) => {
    if (value !== undefined) {
      params.set(key, String(value));
    }
  });
  const raw = params.toString();
  return raw ? `?${raw}` : '';
}

export function createAdminHash(
  gameKey: string,
  path: string,
  query: Record<string, string | number | boolean | undefined> = {}
): string {
  return `#${path}${buildQueryString({
    gameKey,
    ...query
  })}`;
}

function renderFilters(filters: AdminFilterChip[]): string {
  if (filters.length === 0) {
    return '';
  }

  return `
    <section class="admin-section">
      <div class="admin-chip-row">
        ${filters
          .map(
            (filter) => `
              <div class="admin-chip">
                <span class="admin-chip-label">${escapeHtml(filter.label)}</span>
                <span class="admin-chip-value">${escapeHtml(filter.value)}</span>
              </div>
            `
          )
          .join('')}
      </div>
    </section>
  `;
}

function renderMetrics(metrics: AdminMetricCard[] | undefined): string {
  if (!metrics || metrics.length === 0) {
    return '';
  }

  return `
    <section class="admin-section admin-metric-grid">
      ${metrics
        .map(
          (metric) => `
            <article class="admin-metric-card">
              <div class="admin-metric-label">${escapeHtml(metric.label)}</div>
              <div class="admin-metric-value">${escapeHtml(metric.value)}</div>
            </article>
          `
        )
        .join('')}
    </section>
  `;
}

function renderActionLinks(gameKey: string, actions: AdminLinkAction[] | undefined): string {
  if (!actions || actions.length === 0) {
    return '';
  }

  return `
    <div class="admin-table-actions">
      ${actions
        .map(
          (action) => `
            <a class="admin-link-action" href="${escapeHtml(createAdminHash(gameKey, action.path, action.query))}">
              ${escapeHtml(action.label)}
            </a>
          `
        )
        .join('')}
    </div>
  `;
}

function renderTable(gameKey: string, table: AdminTableSection | undefined): string {
  if (!table) {
    return '';
  }

  const rows =
    table.rows.length === 0
      ? `
        <tr>
          <td class="admin-table-empty" colspan="${table.columns.length + 1}">
            ${escapeHtml(table.emptyText)}
          </td>
        </tr>
      `
      : table.rows
          .map(
            (row) => `
              <tr>
                ${table.columns
                  .map((column) => `<td>${escapeHtml(row.values[column.key] ?? '-')}</td>`)
                  .join('')}
                <td>${renderActionLinks(gameKey, row.actions)}</td>
              </tr>
            `
          )
          .join('');

  return `
    <section class="admin-section admin-panel">
      <div class="admin-panel-head">
        <div>
          <h2>${escapeHtml(table.title)}</h2>
          <p>${escapeHtml(table.description)}</p>
        </div>
      </div>
      <div class="admin-table-wrap">
        <table class="admin-table">
          <thead>
            <tr>
              ${table.columns.map((column) => `<th>${escapeHtml(column.label)}</th>`).join('')}
              <th>操作</th>
            </tr>
          </thead>
          <tbody>
            ${rows}
          </tbody>
        </table>
      </div>
    </section>
  `;
}

function renderNotes(notes: AdminNoteBlock[] | undefined): string {
  if (!notes || notes.length === 0) {
    return '';
  }

  return `
    <section class="admin-note-grid">
      ${notes
        .map(
          (note) => `
            <article class="admin-note-card">
              <h3>${escapeHtml(note.title)}</h3>
              <ul>
                ${note.lines.map((line) => `<li>${escapeHtml(line)}</li>`).join('')}
              </ul>
            </article>
          `
        )
        .join('')}
    </section>
  `;
}

function renderNavigation(snapshot: AdminAppSnapshot): string {
  return `
    <nav class="admin-sidebar">
      <div class="admin-brand">
        <div class="admin-brand-kicker">Mini Game Workflow</div>
        <div class="admin-brand-title">Admin Shell</div>
        <div class="admin-brand-meta">gameKey: ${escapeHtml(snapshot.gameKey)}</div>
      </div>
      <div class="admin-nav-list">
        ${snapshot.navigation
          .map((item) => {
            const activeClass = item.path === snapshot.currentRoute ? ' is-active' : '';
            return `
              <a class="admin-nav-item${activeClass}" href="${escapeHtml(createAdminHash(snapshot.gameKey, item.path))}">
                <span class="admin-nav-label">${escapeHtml(item.label)}</span>
                <span class="admin-nav-desc">${escapeHtml(item.description)}</span>
              </a>
            `;
          })
          .join('')}
      </div>
    </nav>
  `;
}

export function getAdminShellStyles(): string {
  return `
    :root {
      --admin-bg: #f3efe6;
      --admin-surface: rgba(255, 251, 244, 0.92);
      --admin-surface-strong: #fffdf8;
      --admin-ink: #1f2a2a;
      --admin-muted: #6b7268;
      --admin-line: rgba(31, 42, 42, 0.12);
      --admin-accent: #b24c2a;
      --admin-accent-soft: rgba(178, 76, 42, 0.12);
      --admin-shadow: 0 22px 60px rgba(50, 44, 28, 0.12);
      --admin-font: "IBM Plex Sans", "Avenir Next", "Segoe UI", sans-serif;
    }

    * {
      box-sizing: border-box;
    }

    body {
      margin: 0;
      font-family: var(--admin-font);
      color: var(--admin-ink);
      background:
        radial-gradient(circle at top left, rgba(224, 180, 98, 0.2), transparent 28%),
        linear-gradient(180deg, #f7f0df 0%, #ece6d8 100%);
    }

    .admin-shell {
      min-height: 100vh;
      display: grid;
      grid-template-columns: 290px 1fr;
      gap: 24px;
      padding: 24px;
    }

    .admin-sidebar,
    .admin-main {
      border: 1px solid var(--admin-line);
      border-radius: 24px;
      background: var(--admin-surface);
      backdrop-filter: blur(10px);
      box-shadow: var(--admin-shadow);
    }

    .admin-sidebar {
      padding: 22px 18px;
      display: flex;
      flex-direction: column;
      gap: 18px;
    }

    .admin-brand-kicker {
      font-size: 12px;
      letter-spacing: 0.16em;
      text-transform: uppercase;
      color: var(--admin-accent);
    }

    .admin-brand-title {
      margin-top: 8px;
      font-size: 28px;
      font-weight: 700;
    }

    .admin-brand-meta {
      margin-top: 8px;
      color: var(--admin-muted);
    }

    .admin-nav-list {
      display: grid;
      gap: 10px;
    }

    .admin-nav-item {
      display: block;
      text-decoration: none;
      color: inherit;
      padding: 14px 16px;
      border-radius: 18px;
      border: 1px solid transparent;
      background: rgba(255, 255, 255, 0.55);
      transition: transform 120ms ease, border-color 120ms ease, background 120ms ease;
    }

    .admin-nav-item:hover,
    .admin-nav-item.is-active {
      transform: translateX(2px);
      border-color: rgba(178, 76, 42, 0.18);
      background: var(--admin-surface-strong);
    }

    .admin-nav-label {
      display: block;
      font-weight: 700;
    }

    .admin-nav-desc {
      display: block;
      margin-top: 5px;
      color: var(--admin-muted);
      font-size: 13px;
      line-height: 1.45;
    }

    .admin-main {
      padding: 28px;
    }

    .admin-hero h1 {
      margin: 0;
      font-size: 34px;
      line-height: 1.1;
    }

    .admin-hero p {
      margin: 10px 0 0;
      color: var(--admin-muted);
      max-width: 680px;
      line-height: 1.6;
    }

    .admin-section {
      margin-top: 22px;
    }

    .admin-chip-row {
      display: flex;
      flex-wrap: wrap;
      gap: 10px;
    }

    .admin-chip {
      display: inline-flex;
      gap: 10px;
      align-items: center;
      padding: 10px 14px;
      border-radius: 999px;
      background: var(--admin-surface-strong);
      border: 1px solid var(--admin-line);
    }

    .admin-chip-label {
      color: var(--admin-muted);
      font-size: 13px;
    }

    .admin-chip-value {
      font-weight: 700;
    }

    .admin-metric-grid {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
      gap: 16px;
    }

    .admin-metric-card,
    .admin-note-card {
      padding: 18px;
      border-radius: 22px;
      background: var(--admin-surface-strong);
      border: 1px solid var(--admin-line);
    }

    .admin-metric-label {
      color: var(--admin-muted);
      font-size: 14px;
    }

    .admin-metric-value {
      margin-top: 10px;
      font-size: 34px;
      font-weight: 700;
      color: var(--admin-accent);
    }

    .admin-panel {
      padding: 20px;
    }

    .admin-panel-head h2 {
      margin: 0;
      font-size: 24px;
    }

    .admin-panel-head p {
      margin: 8px 0 0;
      color: var(--admin-muted);
      line-height: 1.55;
    }

    .admin-table-wrap {
      margin-top: 18px;
      overflow-x: auto;
    }

    .admin-table {
      width: 100%;
      border-collapse: collapse;
      min-width: 760px;
    }

    .admin-table th,
    .admin-table td {
      padding: 14px 12px;
      border-bottom: 1px solid var(--admin-line);
      text-align: left;
      vertical-align: top;
      font-size: 14px;
    }

    .admin-table th {
      color: var(--admin-muted);
      font-weight: 600;
      white-space: nowrap;
    }

    .admin-table-empty {
      color: var(--admin-muted);
      text-align: center;
      padding: 28px 12px;
    }

    .admin-table-actions {
      display: flex;
      flex-wrap: wrap;
      gap: 8px;
    }

    .admin-link-action {
      display: inline-flex;
      align-items: center;
      padding: 6px 10px;
      border-radius: 999px;
      background: var(--admin-accent-soft);
      color: var(--admin-accent);
      text-decoration: none;
      font-size: 12px;
      font-weight: 700;
    }

    .admin-note-grid {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
      gap: 16px;
      margin-top: 22px;
    }

    .admin-note-card h3 {
      margin: 0 0 10px;
      font-size: 18px;
    }

    .admin-note-card ul {
      margin: 0;
      padding-left: 18px;
      color: var(--admin-muted);
      line-height: 1.6;
    }

    @media (max-width: 960px) {
      .admin-shell {
        grid-template-columns: 1fr;
      }

      .admin-main {
        padding: 22px 18px;
      }

      .admin-hero h1 {
        font-size: 28px;
      }
    }
  `;
}

export function renderAdminSnapshot(snapshot: AdminAppSnapshot): string {
  return `
    <style>${getAdminShellStyles()}</style>
    <div class="admin-shell">
      ${renderNavigation(snapshot)}
      <main class="admin-main">
        <header class="admin-hero">
          <h1>${escapeHtml(snapshot.page.title)}</h1>
          <p>${escapeHtml(snapshot.page.description)}</p>
        </header>
        ${renderFilters(snapshot.page.filters)}
        ${renderMetrics(snapshot.page.metrics)}
        ${renderTable(snapshot.gameKey, snapshot.page.table)}
        ${renderNotes(snapshot.page.notes)}
      </main>
    </div>
  `;
}

export function mountAdminSnapshot(target: AdminRenderTarget, snapshot: AdminAppSnapshot): string {
  const html = renderAdminSnapshot(snapshot);
  target.innerHTML = html;
  return html;
}
