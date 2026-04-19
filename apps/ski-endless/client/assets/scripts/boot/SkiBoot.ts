import { _decorator, Component, Label, director } from 'cc';
import { bootstrapSkiEndlessRuntime } from './bootstrapSkiEndlessRuntime';
import { SkiRuntimeSessionStore } from '../app/SkiRuntimeSessionStore';
import { SkiEndlessPrototypeController } from '../game/SkiEndlessPrototypeController';

const { ccclass, property } = _decorator;

@ccclass('SkiBoot')
export class SkiBoot extends Component {
  @property(Label)
  statusLabel: Label | null = null;

  @property
  nextSceneName = '';

  @property
  autoEnterDelaySeconds = 0.2;

  private controller: SkiEndlessPrototypeController | null = null;

  async start(): Promise<void> {
    this.renderStatus('Booting ski-endless runtime...');

    try {
      const { runtime, session } = await bootstrapSkiEndlessRuntime();
      SkiRuntimeSessionStore.set({
        runtime,
        session
      });

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
          `mode=${snapshot.selectedMode}`,
          this.nextSceneName ? `entering=${this.nextSceneName}` : 'entering=manual'
        ].join('\n')
      );

      if (this.nextSceneName.trim()) {
        this.scheduleOnce(() => {
          director.loadScene(this.nextSceneName, (error) => {
            if (error) {
              this.renderStatus(`Failed to enter scene: ${error.message}`);
            }
          });
        }, this.autoEnterDelaySeconds);
      }
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
