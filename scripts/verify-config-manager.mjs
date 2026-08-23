import assert from 'node:assert/strict';
import { createConfigManager } from '../packages/game-core-client/dist/game-core-client/src/config/createConfigManager.js';

const manager = createConfigManager();

assert.throws(() => manager.getAll(), /has not been initialized/);
assert.throws(() => manager.get((config) => config.enabled), /has not been initialized/);
assert.equal(manager.getVersion(), 'local');

const localConfig = {
  enabled: true,
  gameplay: {
    speed: 1,
    lanes: 3
  }
};
const refreshContexts = [];
let remoteResponse = {
  configVersion: 'remote-1',
  gameKey: 'config_test',
  payload: {
    enabled: false,
    gameplay: {
      speed: 2
    }
  },
  updatedAt: 1
};

await manager.init({
  loadLocal: async () => localConfig,
  loadRemote: async (context) => {
    refreshContexts.push(context);
    if (remoteResponse instanceof Error) {
      throw remoteResponse;
    }

    return remoteResponse;
  },
  merge: (local, remote = {}) => ({
    ...local,
    ...remote,
    gameplay: {
      ...local.gameplay,
      ...remote.gameplay
    }
  })
});

assert.deepEqual(manager.getAll(), localConfig);
assert.equal(manager.get((config) => config.gameplay.lanes), 3);
assert.equal(manager.getVersion(), 'local');

await manager.refresh();
assert.equal(refreshContexts.length, 0);
assert.equal(manager.getVersion(), 'local');

const firstContext = {
  gameKey: 'config_test',
  platform: 'web',
  clientVersion: '0.1.0'
};
await manager.refresh(firstContext);
assert.deepEqual(refreshContexts, [firstContext]);
assert.deepEqual(manager.getAll(), {
  enabled: false,
  gameplay: {
    speed: 2,
    lanes: 3
  }
});
assert.equal(manager.getVersion(), 'remote-1');

remoteResponse = {
  configVersion: 'remote-2',
  gameKey: 'config_test',
  payload: {
    gameplay: {
      lanes: 5
    }
  },
  updatedAt: 2
};
await manager.refresh(firstContext);
assert.deepEqual(manager.getAll(), {
  enabled: false,
  gameplay: {
    speed: 2,
    lanes: 5
  }
});
assert.equal(manager.getVersion(), 'remote-2');

remoteResponse = new Error('remote config unavailable');
await assert.rejects(() => manager.refresh(firstContext), /remote config unavailable/);
assert.deepEqual(manager.getAll(), {
  enabled: false,
  gameplay: {
    speed: 2,
    lanes: 5
  }
});
assert.equal(manager.getVersion(), 'remote-2');

const localOnlyManager = createConfigManager();
await localOnlyManager.init({
  loadLocal: async () => ({ enabled: true }),
  merge: (local, remote = {}) => ({ ...local, ...remote })
});
await localOnlyManager.refresh(firstContext);
assert.deepEqual(localOnlyManager.getAll(), { enabled: true });
assert.equal(localOnlyManager.getVersion(), 'local');

console.log(
  JSON.stringify(
    {
      configVersion: manager.getVersion(),
      config: manager.getAll(),
      refreshCount: refreshContexts.length,
      localOnlyVersion: localOnlyManager.getVersion()
    },
    null,
    2
  )
);
