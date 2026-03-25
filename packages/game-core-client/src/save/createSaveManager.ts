import type { SaveDefinition, SaveEnvelope } from '@mini-game-workflow/game-core-types';
import type { SaveManager } from './SaveManager.js';

export function createSaveManager<TData>(definition: SaveDefinition<TData>): SaveManager<TData> {
  let save: SaveEnvelope<TData> | null = null;

  return {
    async init(): Promise<void> {
      if (!save) {
        save = {
          schemaVersion: definition.schemaVersion,
          data: definition.createDefaultData(),
          updatedAt: Date.now()
        };
      }
    },
    getAll(): Readonly<SaveEnvelope<TData>> {
      if (!save) {
        throw new Error('SaveManager has not been initialized.');
      }

      return save;
    },
    async replace(data: TData): Promise<void> {
      save = {
        schemaVersion: definition.schemaVersion,
        data,
        updatedAt: Date.now()
      };
    }
  };
}
