import {
  _decorator,
  Color,
  Component,
  EventKeyboard,
  EventTouch,
  Graphics,
  HorizontalTextAlignment,
  Input,
  KeyCode,
  Label,
  Node,
  UITransform,
  Vec3,
  input,
  view
} from 'cc';
import { SkiRuntimeSessionStore } from '../app/SkiRuntimeSessionStore';
import { type SkiMapKey, type SkiModeKey } from '../config/SkiEndlessConfig';
import { SkiEndlessPrototypeController, type SkiRunSummary } from './SkiEndlessPrototypeController';

const { ccclass, property } = _decorator;

type LaneIndex = -1 | 0 | 1;
type EntityKind = 'obstacle' | 'coin';
type ObstacleType = 'tree' | 'rock' | 'gate';

const PLAYER_Y = -235;
const SPAWN_Y = 470;
const DESPAWN_Y = -420;
const LANE_BASE_X = 185;
const TRACK_HALF_WIDTH_TOP = 230;
const TRACK_HALF_WIDTH_BOTTOM = 440;

interface ActiveRunState {
  mode: SkiModeKey;
  map: SkiMapKey;
  baseSpeed: number;
  maxSpeed: number;
  distance: number;
  speed: number;
  coinsCollected: number;
  laneIndex: LaneIndex;
  reviveUsed: boolean;
  doubleClaimed: boolean;
  finished: boolean;
}

interface TrackEntity {
  kind: EntityKind;
  obstacleType?: ObstacleType;
  laneIndex: LaneIndex;
  y: number;
  node: Node;
  colliderRadius: number;
}

interface StripeVisual {
  node: Node;
  y: number;
}

@ccclass('SkiEndlessGameScene')
export class SkiEndlessGameScene extends Component {
  @property(Label)
  hudLabel: Label | null = null;

  @property(Label)
  hintLabel: Label | null = null;

  @property(Label)
  resultLabel: Label | null = null;

  @property(Node)
  skierNode: Node | null = null;

  private controller: SkiEndlessPrototypeController | null = null;
  private runState: ActiveRunState | null = null;
  private lastSummary: SkiRunSummary | null = null;
  private sessionUserId: number | null = null;
  private lastCoinMilestone = 0;
  private busy = false;
  private savedCoinBank = 0;
  private spawnTimer = 0;
  private entities: TrackEntity[] = [];
  private stripes: StripeVisual[] = [];
  private canvasNode: Node | null = null;
  private backgroundRoot: Node | null = null;
  private itemRoot: Node | null = null;
  private overlayRoot: Node | null = null;

  start(): void {
    const runtimeSession = SkiRuntimeSessionStore.get();

    if (!runtimeSession) {
      this.renderFatal('Runtime session missing. Return to Boot scene first.');
      return;
    }

    this.sessionUserId = runtimeSession.session.user.id;
    this.controller = new SkiEndlessPrototypeController(runtimeSession.runtime);
    this.savedCoinBank = this.controller.getSnapshot().coins;
    this.ensureSceneNodes();
    this.applyDefaultLayout();
    this.buildTrackVisuals();
    this.renderHint();
    this.startNewRun();

    input.on(Input.EventType.KEY_DOWN, this.onKeyDown, this);
    input.on(Input.EventType.TOUCH_START, this.onTouchStart, this);
  }

  onDestroy(): void {
    input.off(Input.EventType.KEY_DOWN, this.onKeyDown, this);
    input.off(Input.EventType.TOUCH_START, this.onTouchStart, this);
  }

  update(deltaTime: number): void {
    this.updateTrackVisuals(deltaTime);

    if (!this.runState || this.runState.finished) {
      return;
    }

    const run = this.runState;
    run.speed = Math.min(run.maxSpeed, run.speed + deltaTime * 0.8);
    run.distance += run.speed * deltaTime * 13;

    const coinMilestone = Math.floor(run.distance / 28);
    if (coinMilestone > this.lastCoinMilestone) {
      run.coinsCollected += coinMilestone - this.lastCoinMilestone;
      this.lastCoinMilestone = coinMilestone;
    }

    this.spawnTimer += deltaTime;
    const spawnInterval = Math.max(0.38, 0.92 - (run.speed - run.baseSpeed) * 0.04);
    if (this.spawnTimer >= spawnInterval) {
      this.spawnTimer = 0;
      this.spawnPattern();
    }

    this.updateEntities(deltaTime, run.speed);
    this.updateSkierVisual(run.laneIndex);
    this.renderHud();
  }

  private onKeyDown(event: EventKeyboard): void {
    if (!this.controller || this.busy) {
      return;
    }

    if (!this.runState) {
      if (event.keyCode === KeyCode.KEY_R) {
        this.startNewRun();
      }
      return;
    }

    switch (event.keyCode) {
      case KeyCode.ARROW_LEFT:
      case KeyCode.KEY_A:
        this.shiftLane(-1);
        break;
      case KeyCode.ARROW_RIGHT:
      case KeyCode.KEY_D:
        this.shiftLane(1);
        break;
      case KeyCode.SPACE:
        void this.finishRun('manual_crash');
        break;
      case KeyCode.KEY_R:
        if (this.runState.finished) {
          this.startNewRun();
        }
        break;
      case KeyCode.KEY_V:
        if (this.runState.finished && !this.runState.reviveUsed) {
          void this.reviveRun();
        }
        break;
      case KeyCode.KEY_C:
        if (this.runState.finished && !this.runState.doubleClaimed && this.lastSummary && this.lastSummary.coinsCollected > 0) {
          void this.claimDoubleCoins();
        }
        break;
      default:
        break;
    }
  }

  private onTouchStart(event: EventTouch): void {
    if (!this.runState || this.runState.finished || this.busy) {
      return;
    }

    const visibleSize = view.getVisibleSize();
    const location = event.getUILocation();
    const sectionWidth = visibleSize.width / 3;

    if (location.x < sectionWidth) {
      this.setLane(-1);
      return;
    }

    if (location.x > sectionWidth * 2) {
      this.setLane(1);
      return;
    }

    void this.finishRun('touch_center_stop');
  }

  private ensureSceneNodes(): void {
    this.canvasNode = this.node.parent ?? null;

    if (!this.canvasNode) {
      throw new Error('SkiEndlessGameScene must be mounted under Canvas.');
    }

    this.backgroundRoot = this.ensureChildNode(this.canvasNode, 'BackgroundRoot', -1);
    this.itemRoot = this.ensureChildNode(this.canvasNode, 'ItemRoot', -1);
    this.overlayRoot = this.ensureChildNode(this.canvasNode, 'OverlayRoot', -1);

    this.hudLabel = this.hudLabel ?? this.ensureLabelNode(this.overlayRoot, 'HudLabel', 26);
    this.hintLabel = this.hintLabel ?? this.ensureLabelNode(this.overlayRoot, 'HintLabel', 26);
    this.resultLabel = this.resultLabel ?? this.ensureLabelNode(this.overlayRoot, 'ResultLabel', 28);
    this.skierNode = this.skierNode ?? this.ensureChildNode(this.itemRoot, 'Skier', 4);

    this.ensureGraphics(this.skierNode);
  }

  private buildTrackVisuals(): void {
    if (!this.backgroundRoot || !this.itemRoot) {
      return;
    }

    this.backgroundRoot.removeAllChildren();
    this.itemRoot.removeAllChildren();
    this.entities = [];
    this.stripes = [];

    const skyNode = this.createGraphicsNode('Sky', this.backgroundRoot, -5);
    this.drawRect(skyNode, 0, 160, 1280, 560, new Color(122, 181, 235, 255));

    const trackNode = this.createGraphicsNode('Track', this.backgroundRoot, 0);
    const trackGraphics = this.ensureGraphics(trackNode);
    trackGraphics.clear();
    trackGraphics.fillColor = new Color(238, 245, 250, 255);
    trackGraphics.moveTo(-TRACK_HALF_WIDTH_TOP, 340);
    trackGraphics.lineTo(TRACK_HALF_WIDTH_TOP, 340);
    trackGraphics.lineTo(TRACK_HALF_WIDTH_BOTTOM, -360);
    trackGraphics.lineTo(-TRACK_HALF_WIDTH_BOTTOM, -360);
    trackGraphics.close();
    trackGraphics.fill();

    const edgeGraphics = this.createGraphicsNode('TrackEdge', this.backgroundRoot, 1);
    const edge = this.ensureGraphics(edgeGraphics);
    edge.clear();
    edge.strokeColor = new Color(208, 222, 232, 255);
    edge.lineWidth = 6;
    edge.moveTo(-TRACK_HALF_WIDTH_TOP, 340);
    edge.lineTo(-TRACK_HALF_WIDTH_BOTTOM, -360);
    edge.moveTo(TRACK_HALF_WIDTH_TOP, 340);
    edge.lineTo(TRACK_HALF_WIDTH_BOTTOM, -360);
    edge.stroke();

    for (let index = 0; index < 3; index += 1) {
      const stripeNode = this.createGraphicsNode(`Stripe-${index}`, this.backgroundRoot, 2);
      const graphic = this.ensureGraphics(stripeNode);
      graphic.clear();
      graphic.fillColor = new Color(255, 255, 255, 92);
      graphic.roundRect(-70, -10, 140, 20, 10);
      graphic.fill();
      this.stripes.push({
        node: stripeNode,
        y: 260 - index * 220
      });
    }

    const leftGuide = this.createGraphicsNode('LaneGuideLeft', this.backgroundRoot, 3);
    const rightGuide = this.createGraphicsNode('LaneGuideRight', this.backgroundRoot, 3);
    this.drawLaneGuide(leftGuide, -1);
    this.drawLaneGuide(rightGuide, 1);

    this.skierNode = this.ensureChildNode(this.itemRoot, 'Skier', 4);
    const skierGraphic = this.ensureGraphics(this.skierNode);
    this.drawSkier(skierGraphic);
    const skierTransform = this.skierNode.getComponent(UITransform);
    if (skierTransform) {
      skierTransform.setContentSize(120, 120);
    }
  }

  private startNewRun(): void {
    if (!this.controller) {
      return;
    }

    const start = this.controller.startRun();
    this.runState = {
      mode: start.mode,
      map: start.map,
      baseSpeed: start.baseSpeed,
      maxSpeed: start.maxSpeed,
      distance: 0,
      speed: start.baseSpeed,
      coinsCollected: 0,
      laneIndex: 0,
      reviveUsed: false,
      doubleClaimed: false,
      finished: false
    };
    this.lastSummary = null;
    this.lastCoinMilestone = 0;
    this.spawnTimer = 0;
    this.clearEntities();
    this.resultLabel && (this.resultLabel.string = 'Run started\nTap left/right or use A/D to switch lanes.');
    this.updateSkierVisual(0);
    this.renderHud();
  }

  private shiftLane(delta: -1 | 1): void {
    if (!this.runState || this.runState.finished) {
      return;
    }

    const next = Math.max(-1, Math.min(1, this.runState.laneIndex + delta)) as LaneIndex;
    this.setLane(next);
  }

  private setLane(laneIndex: LaneIndex): void {
    if (!this.runState || this.runState.finished) {
      return;
    }

    this.runState.laneIndex = laneIndex;
    this.updateSkierVisual(laneIndex);
    this.renderHud();
  }

  private spawnPattern(): void {
    if (!this.itemRoot || !this.runState) {
      return;
    }

    const lanes: LaneIndex[] = [-1, 0, 1].sort(() => Math.random() - 0.5) as LaneIndex[];
    const obstacleCount = this.runState.speed > this.runState.baseSpeed + 5 ? 2 : 1;
    const obstacleTypes: ObstacleType[] = ['tree', 'rock', 'gate'];

    for (let index = 0; index < obstacleCount; index += 1) {
      const lane = lanes[index];
      const obstacleType = obstacleTypes[Math.floor(Math.random() * obstacleTypes.length)];
      this.spawnEntity('obstacle', lane, SPAWN_Y + index * 30, obstacleType);
    }

    const remainingLane = lanes.find((lane) => !this.entities.some((entity) => entity.laneIndex === lane && entity.y > 380));
    if (remainingLane !== undefined && Math.random() > 0.2) {
      this.spawnEntity('coin', remainingLane, SPAWN_Y + 70);
    }
  }

  private spawnEntity(kind: EntityKind, laneIndex: LaneIndex, y: number, obstacleType: ObstacleType = 'tree'): void {
    if (!this.itemRoot) {
      return;
    }

    const node = this.createGraphicsNode(`${kind}-${Date.now()}`, this.itemRoot, 1);
    const graphic = this.ensureGraphics(node);

    if (kind === 'coin') {
      this.drawCoin(graphic);
    } else {
      this.drawObstacle(graphic, obstacleType);
    }

    const transform = node.getComponent(UITransform);
    if (transform) {
      transform.setContentSize(kind === 'coin' ? 48 : 110, kind === 'coin' ? 48 : 120);
    }

    this.entities.push({
      kind,
      obstacleType: kind === 'obstacle' ? obstacleType : undefined,
      laneIndex,
      y,
      node,
      colliderRadius: kind === 'coin' ? 38 : obstacleType === 'gate' ? 60 : 72
    });
    this.positionEntity(this.entities[this.entities.length - 1]);
  }

  private updateEntities(deltaTime: number, speed: number): void {
    const moveDelta = speed * deltaTime * 115;
    const survivors: TrackEntity[] = [];

    for (const entity of this.entities) {
      entity.y -= moveDelta;

      if (entity.y < DESPAWN_Y) {
        entity.node.destroy();
        continue;
      }

      this.positionEntity(entity);

      if (this.runState && !this.runState.finished) {
        const isSameLane = entity.laneIndex === this.runState.laneIndex;
        const isNearPlayer = Math.abs(entity.y - PLAYER_Y) < entity.colliderRadius;

        if (isSameLane && isNearPlayer) {
          if (entity.kind === 'coin') {
            this.runState.coinsCollected += 1;
            entity.node.destroy();
            this.resultLabel && (this.resultLabel.string = `Coin collected\ncoins=${String(this.runState.coinsCollected)}`);
            continue;
          }

          entity.node.destroy();
          void this.finishRun(entity.obstacleType ?? 'obstacle');
          continue;
        }
      }

      survivors.push(entity);
    }

    this.entities = survivors;
  }

  private async finishRun(crashedBy: string): Promise<void> {
    if (!this.controller || !this.runState || this.runState.finished) {
      return;
    }

    this.busy = true;
    try {
      this.lastSummary = await this.controller.finishRun({
        distance: Math.floor(this.runState.distance),
        coinsCollected: this.runState.coinsCollected,
        crashedBy
      });
      this.savedCoinBank = this.controller.getSnapshot().coins;
      this.runState.finished = true;
      this.resultLabel &&
        (this.resultLabel.string = [
          'Run finished',
          `hit=${crashedBy}`,
          `distance=${String(this.lastSummary.distance)}`,
          `score=${String(this.lastSummary.score)}`,
          `coins=${String(this.lastSummary.coinsCollected)}`,
          `savedCoinBank=${String(this.savedCoinBank)}`,
          'V: revive once',
          'C: claim double coins',
          'R: restart run'
        ].join('\n'));
      this.renderHud();
    } finally {
      this.busy = false;
    }
  }

  private async reviveRun(): Promise<void> {
    if (!this.controller || !this.runState || !this.runState.finished || this.runState.reviveUsed) {
      return;
    }

    this.busy = true;
    try {
      const verification = await this.controller.requestRevive();
      if (!verification.verified || !verification.completed) {
        this.resultLabel && (this.resultLabel.string = 'Revive failed');
        return;
      }

      this.runState.finished = false;
      this.runState.reviveUsed = true;
      this.runState.speed = Math.max(this.runState.baseSpeed, this.runState.speed * 0.72);
      this.entities.forEach((entity) => {
        if (Math.abs(entity.y - PLAYER_Y) < 140) {
          entity.node.destroy();
        }
      });
      this.entities = this.entities.filter((entity) => Math.abs(entity.y - PLAYER_Y) >= 140);
      this.resultLabel && (this.resultLabel.string = `Revived\nverification=${verification.verificationId}`);
      this.renderHud();
    } finally {
      this.busy = false;
    }
  }

  private async claimDoubleCoins(): Promise<void> {
    if (!this.controller || !this.lastSummary || !this.runState || this.runState.doubleClaimed) {
      return;
    }

    this.busy = true;
    try {
      const reward = await this.controller.claimDoubleCoinReward(this.lastSummary.coinsCollected);
      this.runState.doubleClaimed = true;
      this.resultLabel &&
        (this.resultLabel.string = [
          this.resultLabel.string,
          'double-coin claimed',
          `rewardType=${reward.rewardType}`,
          `amount=${String(reward.amount)}`,
          `balanceAfter=${String(reward.balanceAfter)}`
        ].join('\n'));
    } finally {
      this.busy = false;
    }
  }

  private updateTrackVisuals(deltaTime: number): void {
    if (!this.runState) {
      return;
    }

    const stripeDelta = this.runState.speed * deltaTime * 80;
    const cycleHeight = 680;

    for (const stripe of this.stripes) {
      stripe.y -= stripeDelta;
      if (stripe.y < -310) {
        stripe.y += cycleHeight;
      }

      const progress = this.getProgressFromY(stripe.y);
      const halfWidth = this.interpolate(TRACK_HALF_WIDTH_TOP - 40, TRACK_HALF_WIDTH_BOTTOM - 70, progress);
      stripe.node.setPosition(0, stripe.y, 0);
      stripe.node.setScale(halfWidth / 120, 1 + progress * 1.8, 1);
    }
  }

  private renderHud(): void {
    if (!this.hudLabel) {
      return;
    }

    if (!this.runState) {
      this.hudLabel.string = 'No active run';
      return;
    }

    this.hudLabel.string = [
      `userId=${String(this.sessionUserId ?? 0)}`,
      `mode=${this.runState.mode}`,
      `map=${this.runState.map}`,
      `distance=${String(Math.floor(this.runState.distance))}m`,
      `speed=${this.runState.speed.toFixed(1)}`,
      `runCoins=${String(this.runState.coinsCollected)}`,
      `bankedCoins=${String(this.savedCoinBank)}`,
      `lane=${String(this.runState.laneIndex)}`,
      `reviveUsed=${String(this.runState.reviveUsed)}`
    ].join('\n');
  }

  private renderHint(): void {
    if (!this.hintLabel) {
      return;
    }

    this.hintLabel.string = [
      'Desktop:',
      'A / Left = left lane',
      'D / Right = right lane',
      'Space = force finish',
      '',
      'Mobile:',
      'Tap left / right side to switch',
      'Tap center to finish',
      '',
      'After finish:',
      'V = revive once',
      'C = double coins',
      'R = restart'
    ].join('\n');
  }

  private applyDefaultLayout(): void {
    this.configureLabelNode(this.hudLabel, new Vec3(-480, 245, 0), HorizontalTextAlignment.LEFT, 360, 270);
    this.configureLabelNode(this.hintLabel, new Vec3(310, 220, 0), HorizontalTextAlignment.LEFT, 340, 320);
    this.configureLabelNode(this.resultLabel, new Vec3(-470, -160, 0), HorizontalTextAlignment.LEFT, 420, 250);

    if (this.skierNode) {
      this.skierNode.setPosition(0, PLAYER_Y, 0);
      const transform = this.skierNode.getComponent(UITransform);
      if (transform) {
        transform.setContentSize(120, 120);
      }
    }
  }

  private renderFatal(message: string): void {
    this.hudLabel && (this.hudLabel.string = message);
    this.resultLabel && (this.resultLabel.string = message);
  }

  private updateSkierVisual(laneIndex: LaneIndex): void {
    if (!this.skierNode) {
      return;
    }

    this.skierNode.setPosition(this.getLaneX(laneIndex, 0.98), PLAYER_Y, 0);
    this.skierNode.angle = -laneIndex * 6;
  }

  private configureLabelNode(
    label: Label | null,
    position: Vec3,
    align: HorizontalTextAlignment,
    width: number,
    height: number
  ): void {
    if (!label) {
      return;
    }

    label.node.setPosition(position);
    label.horizontalAlign = align;
    label.overflow = Label.Overflow.SHRINK;
    label.color = new Color(255, 255, 255, 255);
    label.fontSize = 24;
    label.lineHeight = 28;

    const transform = label.getComponent(UITransform);
    if (transform) {
      transform.setContentSize(width, height);
      label.node.setScale(1, 1, 1);
    }
  }

  private positionEntity(entity: TrackEntity): void {
    const progress = this.getProgressFromY(entity.y);
    const laneSpread = this.interpolate(0.72, 1.08, progress);
    const x = this.getLaneX(entity.laneIndex, laneSpread);
    const scale = this.interpolate(0.62, 1.35, progress);

    entity.node.setPosition(x, entity.y, 0);
    entity.node.setScale(scale, scale, 1);
  }

  private getLaneX(laneIndex: LaneIndex, spread: number): number {
    return laneIndex * LANE_BASE_X * spread;
  }

  private getProgressFromY(y: number): number {
    const raw = (SPAWN_Y - y) / (SPAWN_Y - PLAYER_Y + 90);
    return Math.max(0, Math.min(1, raw));
  }

  private interpolate(start: number, end: number, progress: number): number {
    return start + (end - start) * progress;
  }

  private clearEntities(): void {
    this.entities.forEach((entity) => entity.node.destroy());
    this.entities = [];
  }

  private ensureChildNode(parent: Node, name: string, siblingIndex: number): Node {
    const existing = parent.getChildByName(name);
    if (existing) {
      return existing;
    }

    const node = new Node(name);
    parent.addChild(node);
    if (siblingIndex >= 0) {
      node.setSiblingIndex(siblingIndex);
    }
    return node;
  }

  private ensureLabelNode(parent: Node, name: string, fontSize: number): Label {
    const node = this.ensureChildNode(parent, name, 10);
    let transform = node.getComponent(UITransform);
    if (!transform) {
      transform = node.addComponent(UITransform);
    }
    let label = node.getComponent(Label);
    if (!label) {
      label = node.addComponent(Label);
    }
    label.fontSize = fontSize;
    label.lineHeight = fontSize + 6;
    label.color = new Color(255, 255, 255, 255);
    return label;
  }

  private createGraphicsNode(name: string, parent: Node, siblingIndex: number): Node {
    const node = new Node(name);
    parent.addChild(node);
    if (siblingIndex >= 0) {
      node.setSiblingIndex(siblingIndex);
    }
    node.addComponent(UITransform);
    node.addComponent(Graphics);
    return node;
  }

  private ensureGraphics(node: Node): Graphics {
    let transform = node.getComponent(UITransform);
    if (!transform) {
      transform = node.addComponent(UITransform);
    }

    let graphics = node.getComponent(Graphics);
    if (!graphics) {
      graphics = node.addComponent(Graphics);
    }

    return graphics;
  }

  private drawRect(node: Node, x: number, y: number, width: number, height: number, color: Color): void {
    const graphics = this.ensureGraphics(node);
    graphics.clear();
    graphics.fillColor = color;
    graphics.rect(x - width / 2, y - height / 2, width, height);
    graphics.fill();
  }

  private drawLaneGuide(node: Node, direction: -1 | 1): void {
    const graphics = this.ensureGraphics(node);
    graphics.clear();
    graphics.strokeColor = new Color(255, 255, 255, 55);
    graphics.lineWidth = 4;
    graphics.moveTo(direction * 80, 320);
    graphics.lineTo(direction * 150, -350);
    graphics.stroke();
  }

  private drawSkier(graphics: Graphics): void {
    graphics.clear();
    graphics.fillColor = new Color(40, 48, 64, 255);
    graphics.roundRect(-52, -12, 104, 24, 12);
    graphics.fill();

    graphics.fillColor = new Color(214, 68, 68, 255);
    graphics.moveTo(0, 52);
    graphics.lineTo(-26, -16);
    graphics.lineTo(26, -16);
    graphics.close();
    graphics.fill();

    graphics.fillColor = new Color(245, 245, 245, 255);
    graphics.circle(0, 18, 10);
    graphics.fill();
  }

  private drawCoin(graphics: Graphics): void {
    graphics.clear();
    graphics.fillColor = new Color(246, 196, 44, 255);
    graphics.circle(0, 0, 22);
    graphics.fill();

    graphics.strokeColor = new Color(255, 242, 160, 255);
    graphics.lineWidth = 4;
    graphics.circle(0, 0, 16);
    graphics.stroke();
  }

  private drawObstacle(graphics: Graphics, obstacleType: ObstacleType): void {
    graphics.clear();

    if (obstacleType === 'tree') {
      graphics.fillColor = new Color(83, 59, 38, 255);
      graphics.rect(-10, -40, 20, 30);
      graphics.fill();

      graphics.fillColor = new Color(34, 138, 72, 255);
      graphics.moveTo(0, 48);
      graphics.lineTo(-42, -8);
      graphics.lineTo(42, -8);
      graphics.close();
      graphics.fill();
      return;
    }

    if (obstacleType === 'gate') {
      graphics.fillColor = new Color(212, 62, 62, 255);
      graphics.rect(-34, -44, 10, 90);
      graphics.rect(24, -44, 10, 90);
      graphics.fill();

      graphics.fillColor = new Color(255, 255, 255, 255);
      graphics.rect(-24, 8, 48, 10);
      graphics.fill();
      return;
    }

    graphics.fillColor = new Color(110, 118, 134, 255);
    graphics.moveTo(0, 44);
    graphics.lineTo(-46, 12);
    graphics.lineTo(-34, -34);
    graphics.lineTo(28, -40);
    graphics.lineTo(50, 2);
    graphics.close();
    graphics.fill();
  }
}
