import type { SaveEnvelope } from '@mini-game-workflow/game-core-types';

export interface SaveManager<TData> {
  init(): Promise<void>;
  getAll(): Readonly<SaveEnvelope<TData>>;
  replace(data: TData): Promise<void>;
  restore(envelope: SaveEnvelope<TData>): Promise<void>;
}
