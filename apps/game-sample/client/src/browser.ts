import { bootstrapGameSample, type BootstrapGameSampleOptions, type BootstrapGameSampleResult } from './bootstrap.js';

declare global {
  interface Window {
    __MINI_GAME_SAMPLE__?: {
      baseURL?: string;
      containerSelector?: string;
    };
  }
}

export interface GameSampleRenderTarget {
  innerHTML: string;
}

export interface GameSampleRewardState {
  verificationId: string;
  rewardType: string;
  amount: number;
  balanceAfter: number;
}

export interface GameSampleBrowserSnapshot {
  baseURL: string;
  gameKey: string;
  userId: number;
  platform: string;
  configVersion: string;
  adEnabled: boolean;
  save: {
    schemaVersion: number;
    coins: number;
    level: number;
    updatedAt: number;
  };
  lastMessage?: string;
  lastReward?: GameSampleRewardState;
}

export interface BootstrapGameSampleBrowserOptions extends BootstrapGameSampleOptions {
  target?: GameSampleRenderTarget;
}

export interface BootstrapGameSampleBrowserResult extends BootstrapGameSampleResult {
  snapshot: GameSampleBrowserSnapshot;
  html: string;
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function formatTimestamp(value: number): string {
  return new Date(value).toISOString();
}

function createSnapshot(
  result: BootstrapGameSampleResult,
  baseURL: string,
  lastMessage?: string,
  lastReward?: GameSampleRewardState
): GameSampleBrowserSnapshot {
  const save = result.runtime.save.getAll();
  const config = result.runtime.config.getAll();

  return {
    baseURL,
    gameKey: result.runtime.gameConfig.gameKey,
    userId: result.session.user.id,
    platform: result.session.user.platform,
    configVersion: result.runtime.config.getVersion(),
    adEnabled: config.ad.enabled,
    save: {
      schemaVersion: save.schemaVersion,
      coins: save.data.coins,
      level: save.data.level,
      updatedAt: save.updatedAt
    },
    lastMessage,
    lastReward
  };
}

function getSampleStyles(): string {
  return `
    :root {
      --sample-bg: #f4efe5;
      --sample-card: rgba(255, 252, 246, 0.94);
      --sample-ink: #1e2723;
      --sample-muted: #66706a;
      --sample-accent: #17624b;
      --sample-accent-soft: rgba(23, 98, 75, 0.12);
      --sample-line: rgba(30, 39, 35, 0.12);
      --sample-shadow: 0 24px 64px rgba(41, 48, 35, 0.12);
      --sample-font: "IBM Plex Sans", "Avenir Next", "Segoe UI", sans-serif;
    }

    * {
      box-sizing: border-box;
    }

    body {
      margin: 0;
      font-family: var(--sample-font);
      background:
        radial-gradient(circle at top left, rgba(59, 126, 96, 0.18), transparent 30%),
        linear-gradient(180deg, #f8f3ea 0%, #ece7dd 100%);
      color: var(--sample-ink);
    }

    .sample-shell {
      min-height: 100vh;
      padding: 24px;
    }

    .sample-stage {
      max-width: 1080px;
      margin: 0 auto;
      display: grid;
      gap: 20px;
    }

    .sample-hero,
    .sample-panel {
      border: 1px solid var(--sample-line);
      border-radius: 24px;
      background: var(--sample-card);
      box-shadow: var(--sample-shadow);
      backdrop-filter: blur(8px);
    }

    .sample-hero {
      padding: 28px;
    }

    .sample-hero h1 {
      margin: 0;
      font-size: 34px;
      line-height: 1.08;
    }

    .sample-hero p {
      margin: 10px 0 0;
      color: var(--sample-muted);
      line-height: 1.6;
      max-width: 720px;
    }

    .sample-meta {
      margin-top: 18px;
      display: flex;
      flex-wrap: wrap;
      gap: 10px;
    }

    .sample-chip {
      display: inline-flex;
      align-items: center;
      gap: 8px;
      padding: 10px 14px;
      border-radius: 999px;
      background: rgba(255, 255, 255, 0.72);
      border: 1px solid var(--sample-line);
      font-size: 13px;
    }

    .sample-chip strong {
      color: var(--sample-accent);
    }

    .sample-grid {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(240px, 1fr));
      gap: 18px;
    }

    .sample-panel {
      padding: 20px;
    }

    .sample-panel h2 {
      margin: 0;
      font-size: 21px;
    }

    .sample-panel p {
      margin: 8px 0 0;
      color: var(--sample-muted);
      line-height: 1.55;
    }

    .sample-kv {
      margin-top: 16px;
      display: grid;
      gap: 10px;
    }

    .sample-kv-row {
      display: flex;
      justify-content: space-between;
      gap: 16px;
      padding-bottom: 10px;
      border-bottom: 1px solid var(--sample-line);
    }

    .sample-kv-row span:first-child {
      color: var(--sample-muted);
    }

    .sample-actions {
      display: flex;
      flex-wrap: wrap;
      gap: 10px;
      margin-top: 18px;
    }

    .sample-button {
      border: 1px solid transparent;
      border-radius: 999px;
      padding: 10px 16px;
      font: inherit;
      font-weight: 700;
      cursor: pointer;
      background: rgba(31, 39, 35, 0.06);
      color: var(--sample-ink);
    }

    .sample-button-primary {
      background: var(--sample-accent);
      color: #f7fffb;
    }

    .sample-banner {
      margin-top: 18px;
      padding: 14px 16px;
      border-radius: 18px;
      background: var(--sample-accent-soft);
      color: var(--sample-accent);
      font-weight: 600;
    }

    @media (max-width: 720px) {
      .sample-shell {
        padding: 16px;
      }

      .sample-hero h1 {
        font-size: 28px;
      }
    }
  `;
}

export function renderGameSampleSnapshot(snapshot: GameSampleBrowserSnapshot): string {
  return `
    <style>${getSampleStyles()}</style>
    <div class="sample-shell">
      <div class="sample-stage">
        <section class="sample-hero">
          <h1>Game Sample Browser</h1>
          <p>这个页面直接连真实 API baseURL，用来验证登录、配置、存档、广告校验和奖励链路。</p>
          <div class="sample-meta">
            <div class="sample-chip"><span>Game</span><strong>${escapeHtml(snapshot.gameKey)}</strong></div>
            <div class="sample-chip"><span>User</span><strong>${escapeHtml(String(snapshot.userId))}</strong></div>
            <div class="sample-chip"><span>Platform</span><strong>${escapeHtml(snapshot.platform)}</strong></div>
            <div class="sample-chip"><span>API</span><strong>${escapeHtml(snapshot.baseURL)}</strong></div>
          </div>
          ${
            snapshot.lastMessage
              ? `<div class="sample-banner">${escapeHtml(snapshot.lastMessage)}</div>`
              : ''
          }
        </section>

        <section class="sample-grid">
          <article class="sample-panel">
            <h2>配置快照</h2>
            <p>当前展示的是 ConfigManager 已经合并后的运行配置。</p>
            <div class="sample-kv">
              <div class="sample-kv-row"><span>configVersion</span><strong>${escapeHtml(snapshot.configVersion)}</strong></div>
              <div class="sample-kv-row"><span>ad.enabled</span><strong>${escapeHtml(String(snapshot.adEnabled))}</strong></div>
            </div>
          </article>

          <article class="sample-panel">
            <h2>存档快照</h2>
            <p>这个区域同时反映本地 SaveManager 状态和最新一次上云结果。</p>
            <div class="sample-kv">
              <div class="sample-kv-row"><span>schemaVersion</span><strong>${escapeHtml(String(snapshot.save.schemaVersion))}</strong></div>
              <div class="sample-kv-row"><span>coins</span><strong>${escapeHtml(String(snapshot.save.coins))}</strong></div>
              <div class="sample-kv-row"><span>level</span><strong>${escapeHtml(String(snapshot.save.level))}</strong></div>
              <div class="sample-kv-row"><span>updatedAt</span><strong>${escapeHtml(formatTimestamp(snapshot.save.updatedAt))}</strong></div>
            </div>
            <div class="sample-actions">
              <button class="sample-button sample-button-primary" type="button" data-sample-action="increment-save">本地 coins +1 并上云</button>
              <button class="sample-button" type="button" data-sample-action="refresh-save">重新拉取云存档</button>
            </div>
          </article>

          <article class="sample-panel">
            <h2>广告奖励链路</h2>
            <p>会依次调用广告展示、广告校验和奖励发放接口，结果展示在下面。</p>
            <div class="sample-kv">
              <div class="sample-kv-row"><span>verificationId</span><strong>${escapeHtml(snapshot.lastReward?.verificationId ?? '-')}</strong></div>
              <div class="sample-kv-row"><span>rewardType</span><strong>${escapeHtml(snapshot.lastReward?.rewardType ?? '-')}</strong></div>
              <div class="sample-kv-row"><span>amount</span><strong>${escapeHtml(snapshot.lastReward ? String(snapshot.lastReward.amount) : '-')}</strong></div>
              <div class="sample-kv-row"><span>balanceAfter</span><strong>${escapeHtml(snapshot.lastReward ? String(snapshot.lastReward.balanceAfter) : '-')}</strong></div>
            </div>
            <div class="sample-actions">
              <button class="sample-button sample-button-primary" type="button" data-sample-action="reward-ad">模拟奖励广告</button>
            </div>
          </article>
        </section>
      </div>
    </div>
  `;
}

export function mountGameSampleSnapshot(target: GameSampleRenderTarget, snapshot: GameSampleBrowserSnapshot): string {
  const html = renderGameSampleSnapshot(snapshot);
  target.innerHTML = html;
  return html;
}

export async function bootstrapAndRenderGameSampleBrowserApp(
  options: BootstrapGameSampleBrowserOptions = {}
): Promise<BootstrapGameSampleBrowserResult> {
  const baseURL = options.baseURL ?? 'http://127.0.0.1:3000';
  const result = await bootstrapGameSample(options);
  const snapshot = createSnapshot(result, baseURL);
  const html = options.target ? mountGameSampleSnapshot(options.target, snapshot) : mountGameSampleSnapshot({ innerHTML: '' }, snapshot);

  return {
    ...result,
    snapshot,
    html
  };
}

export interface StartGameSampleBrowserAppOptions extends BootstrapGameSampleOptions {
  target?: GameSampleRenderTarget;
}

export async function startGameSampleBrowserApp(options: StartGameSampleBrowserAppOptions = {}): Promise<void> {
  const bootstrap = window.__MINI_GAME_SAMPLE__ ?? {};
  const baseURL = options.baseURL ?? bootstrap.baseURL ?? 'http://127.0.0.1:3000';
  const target =
    options.target ??
    (document.querySelector(bootstrap.containerSelector ?? '#app') as GameSampleRenderTarget | null) ??
    document.body;

  const result = await bootstrapGameSample({
    ...options,
    baseURL
  });
  let lastMessage: string | undefined;
  let lastReward: GameSampleRewardState | undefined;

  const render = (): void => {
    mountGameSampleSnapshot(target, createSnapshot(result, baseURL, lastMessage, lastReward));
  };

  render();

  if (!(target instanceof Element)) {
    return;
  }

  target.addEventListener('click', (event) => {
    const rawTarget = event.target;
    const button = rawTarget instanceof Element ? rawTarget.closest<HTMLButtonElement>('[data-sample-action]') : null;

    if (!button) {
      return;
    }

    event.preventDefault();

    void (async () => {
      const action = button.dataset.sampleAction;

      if (action === 'increment-save') {
        const current = result.runtime.save.getAll();
        const nextSave = {
          ...current.data,
          coins: current.data.coins + 1
        };
        await result.runtime.save.replace(nextSave);
        const latest = result.runtime.save.getAll();
        await result.runtime.network.request({
          path: '/api/save',
          method: 'POST',
          requiresAuth: true,
          body: {
            save: {
              schemaVersion: latest.schemaVersion,
              data: latest.data
            }
          }
        });
        lastMessage = '已将本地存档同步到真实 API。';
        render();
        return;
      }

      if (action === 'refresh-save') {
        const remoteSave = await result.runtime.network.request<{
          save: {
            schemaVersion: number;
            data: {
              coins: number;
              level: number;
            };
            updatedAt: number;
          } | null;
        }>({
          path: '/api/save',
          method: 'GET',
          requiresAuth: true
        });

        if (remoteSave.save) {
          await result.runtime.save.replace(remoteSave.save.data);
          lastMessage = '已从真实 API 重新拉取云存档。';
        } else {
          lastMessage = '当前服务端还没有存档记录。';
        }
        render();
        return;
      }

      if (action === 'reward-ad') {
        const adResult = await result.runtime.ad.showRewardedVideo('doubleCoinReward');
        const verification = await result.runtime.network.request<{
          verified: boolean;
          verificationId: string;
          sceneKey: string;
          completed: boolean;
        }>({
          path: '/api/ad/verify',
          method: 'POST',
          requiresAuth: true,
          body: {
            sceneKey: adResult.sceneKey,
            adType: adResult.adType,
            platformResult: {
              completed: adResult.completed
            }
          }
        });
        const reward = await result.runtime.network.request<{
          bizId: string;
          rewardType: string;
          amount: number;
          balanceAfter: number;
          status: string;
        }>({
          path: '/api/reward/claim',
          method: 'POST',
          requiresAuth: true,
          body: {
            rewardType: 'gold',
            amount: 100,
            reason: 'reward_ad',
            bizId: verification.verificationId
          }
        });
        lastReward = {
          verificationId: verification.verificationId,
          rewardType: reward.rewardType,
          amount: reward.amount,
          balanceAfter: reward.balanceAfter
        };
        lastMessage = '奖励广告链路已经走通。';
        render();
      }
    })().catch((error) => {
      lastMessage = error instanceof Error ? error.message : '样例客户端操作失败。';
      render();
    });
  });
}
