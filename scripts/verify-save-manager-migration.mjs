import { createSaveManager } from '../packages/game-core-client/dist/game-core-client/src/save/createSaveManager.js';

const save = createSaveManager({
  schemaVersion: 2,
  createDefaultData() {
    return {
      coins: 0,
      level: 1,
      gems: 0
    };
  },
  migrate(stored) {
    if (stored.schemaVersion >= 2) {
      return stored;
    }

    return {
      schemaVersion: 2,
      updatedAt: stored.updatedAt,
      data: {
        coins: Number(stored.data.coins ?? 0),
        level: Number(stored.data.level ?? 1),
        gems: 10
      }
    };
  }
});

await save.init();
await save.restore({
  schemaVersion: 1,
  updatedAt: 1700000000000,
  data: {
    coins: 7,
    level: 3
  }
});

const restored = save.getAll();

if (restored.schemaVersion !== 2 || restored.data.coins !== 7 || restored.data.level !== 3 || restored.data.gems !== 10) {
  throw new Error(`Unexpected migrated save: ${JSON.stringify(restored)}`);
}

console.log(
  JSON.stringify(
    {
      schemaVersion: restored.schemaVersion,
      updatedAt: restored.updatedAt,
      data: restored.data
    },
    null,
    2
  )
);
