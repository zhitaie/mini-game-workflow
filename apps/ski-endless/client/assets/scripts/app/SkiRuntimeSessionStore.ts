import type { CoreRuntime } from '@mini-game-workflow/game-core-client';
import type { LoginResponse } from '../boot/bootstrapSkiEndlessRuntime';
import type { SkiEndlessConfig } from '../config/SkiEndlessConfig';
import type { SkiEndlessSaveData } from '../data/SkiEndlessSave';

export interface SkiRuntimeSession {
  runtime: CoreRuntime<SkiEndlessConfig, SkiEndlessSaveData>;
  session: LoginResponse;
}

export class SkiRuntimeSessionStore {
  private static current: SkiRuntimeSession | null = null;

  static set(session: SkiRuntimeSession): void {
    this.current = session;
  }

  static get(): SkiRuntimeSession | null {
    return this.current;
  }

  static clear(): void {
    this.current = null;
  }
}
