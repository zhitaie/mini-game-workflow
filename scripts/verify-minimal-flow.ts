import { bootstrapGameSample } from '../apps/game-sample/client/src/bootstrap';
import { createApp } from '../services/api-server/src/app';

async function main(): Promise<void> {
  const app = createApp();
  const { runtime, session } = await bootstrapGameSample({
    baseURL: 'http://local.app',
    fetchImpl: app.fetch
  });

  const adEnabled = runtime.config.get((config: { ad: { enabled: boolean } }) => config.ad.enabled);

  if (adEnabled !== false) {
    throw new Error(`Expected remote config to override ad.enabled to false, got ${String(adEnabled)}`);
  }

  await runtime.save.replace({
    coins: 8,
    level: 2
  });

  const currentSave = runtime.save.getAll();
  await runtime.network.request<{
    save: {
      schemaVersion: number;
      data: {
        coins: number;
        level: number;
      };
      updatedAt: number;
    };
  }>({
    path: '/api/save',
    method: 'POST',
    requiresAuth: true,
    body: {
      save: {
        schemaVersion: currentSave.schemaVersion,
        data: currentSave.data
      }
    }
  });

  const roundTrip = await runtime.network.request<{
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

  if (!roundTrip.save) {
    throw new Error('Expected save to exist after POST /api/save');
  }

  if (roundTrip.save.data.coins !== 8 || roundTrip.save.data.level !== 2) {
    throw new Error(`Unexpected save data: ${JSON.stringify(roundTrip.save.data)}`);
  }

  console.log(
    JSON.stringify(
      {
        userId: session.user.id,
        token: session.token,
        configVersion: runtime.config.getVersion(),
        adEnabled,
        save: roundTrip.save
      },
      null,
      2
    )
  );
}

void main();
