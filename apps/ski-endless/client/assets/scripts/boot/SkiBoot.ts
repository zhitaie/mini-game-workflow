import { _decorator, Component, Label } from 'cc';
import { bootstrapSkiEndlessRuntime } from './bootstrapSkiEndlessRuntime.js';
import { SkiEndlessPrototypeController } from '../game/SkiEndlessPrototypeController.js';

const { ccclass, property } = _decorator;

@ccclass('SkiBoot')
export class SkiBoot extends Component {
  @property(Label)
  statusLabel: Label | null = null;

  private controller: SkiEndlessPrototypeController | null = null;

  async start(): Promise<void> {
    this.renderStatus('Booting ski-endless runtime...');

    try {
      const { runtime, session } = await bootstrapSkiEndlessRuntime();
      this.controller = new SkiEndlessPrototypeController(runtime);
      const snapshot = this.controller.getSnapshot();

      this.renderStatus(
        [
          'ski-endless runtime ready',
          `userId=${String(session.user.id)}`,
          `configVersion=${snapshot.configVersion}`,
          `coins=${String(snapshot.coins)}`,
          `bestDistance=${String(snapshot.bestDistance)}`,
          `map=${snapshot.selectedMap}`,
          `mode=${snapshot.selectedMode}`
        ].join('\n')
      );
    } catch (error) {
      this.renderStatus(error instanceof Error ? error.message : 'Failed to boot ski-endless runtime.');
      throw error;
    }
  }

  getController(): SkiEndlessPrototypeController | null {
    return this.controller;
  }

  private renderStatus(message: string): void {
    if (this.statusLabel) {
      this.statusLabel.string = message;
    }
  }
}
