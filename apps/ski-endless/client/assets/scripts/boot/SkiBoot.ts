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
    this.renderStatus('正在初始化滑雪运行时...');

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
          '滑雪运行时已准备完成',
          `用户 ID：${String(session.user.id)}`,
          `配置版本：${snapshot.configVersion}`,
          `金币：${String(snapshot.coins)}`,
          `最佳距离：${String(snapshot.bestDistance)}`,
          `地图：${snapshot.selectedMap}`,
          `模式：${snapshot.selectedMode}`,
          this.nextSceneName ? `即将进入：${this.nextSceneName}` : '等待手动进入场景'
        ].join('\n')
      );

      if (this.nextSceneName.trim()) {
        this.scheduleOnce(() => {
          director.loadScene(this.nextSceneName, (error) => {
            if (error) {
              this.renderStatus(`进入场景失败：${error.message}`);
            }
          });
        }, this.autoEnterDelaySeconds);
      }
    } catch (error) {
      this.renderStatus(error instanceof Error ? error.message : '滑雪运行时初始化失败。');
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
