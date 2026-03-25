import type { CoreRuntime } from '@mini-game-workflow/game-core-client';

export class GameApp {
  constructor(private readonly runtime: CoreRuntime) {}

  async start(): Promise<void> {
    this.runtime.analytics.track({
      eventName: 'game_launch',
      eventData: {
        gameKey: this.runtime.gameConfig.gameKey
      }
    });

    await this.runtime.analytics.flush();
  }
}

