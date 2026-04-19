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
  Vec2,
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
type ScenePhase = 'home' | 'running' | 'result';
type ButtonActionId = 'start_run' | 'view_rank' | 'view_notice' | 'revive' | 'double_coin' | 'restart' | 'back_home';

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

interface UIButton {
  id: ButtonActionId;
  node: Node;
  background: Graphics;
  label: Label;
  width: number;
  height: number;
  enabled: boolean;
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
  private phase: ScenePhase = 'home';

  private canvasNode: Node | null = null;
  private backgroundRoot: Node | null = null;
  private itemRoot: Node | null = null;
  private overlayRoot: Node | null = null;
  private homePanel: Node | null = null;
  private resultPanel: Node | null = null;
  private homeTitleLabel: Label | null = null;
  private homeInfoLabel: Label | null = null;
  private homeToastLabel: Label | null = null;
  private resultTitleLabel: Label | null = null;
  private resultInfoLabel: Label | null = null;

  private homeButtons: UIButton[] = [];
  private resultButtons: UIButton[] = [];

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
    this.buildPanels();
    this.renderHint();
    this.showHomeScreen();

    input.on(Input.EventType.KEY_DOWN, this.onKeyDown, this);
    input.on(Input.EventType.TOUCH_START, this.onTouchStart, this);
  }

  onDestroy(): void {
    input.off(Input.EventType.KEY_DOWN, this.onKeyDown, this);
    input.off(Input.EventType.TOUCH_START, this.onTouchStart, this);
  }

  update(deltaTime: number): void {
    this.updateTrackVisuals(deltaTime);

    if (!this.runState || this.phase !== 'running' || this.runState.finished) {
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

    if (this.phase === 'home') {
      if (event.keyCode === KeyCode.ENTER || event.keyCode === KeyCode.SPACE) {
        this.startNewRun();
      }
      return;
    }

    if (this.phase === 'result') {
      switch (event.keyCode) {
        case KeyCode.KEY_V:
          void this.reviveRun();
          return;
        case KeyCode.KEY_C:
          void this.claimDoubleCoins();
          return;
        case KeyCode.KEY_R:
          this.startNewRun();
          return;
        case KeyCode.KEY_H:
        case KeyCode.ESCAPE:
          this.showHomeScreen();
          return;
        default:
          return;
      }
    }

    if (!this.runState) {
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
      default:
        break;
    }
  }

  private onTouchStart(event: EventTouch): void {
    const location = event.getUILocation();

    if (this.phase === 'home') {
      if (this.tryHandleButtons(location, this.homeButtons)) {
        return;
      }
      return;
    }

    if (this.phase === 'result') {
      if (this.tryHandleButtons(location, this.resultButtons)) {
        return;
      }
      return;
    }

    if (!this.runState || this.busy) {
      return;
    }

    const visibleSize = view.getVisibleSize();
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
    this.hintLabel = this.hintLabel ?? this.ensureLabelNode(this.overlayRoot, 'HintLabel', 24);
    this.resultLabel = this.resultLabel ?? this.ensureLabelNode(this.overlayRoot, 'ResultLabel', 24);
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

  private buildPanels(): void {
    if (!this.overlayRoot) {
      return;
    }

    this.homePanel = this.ensureChildNode(this.overlayRoot, 'HomePanel', 3);
    this.resultPanel = this.ensureChildNode(this.overlayRoot, 'ResultPanel', 4);

    const homeBackground = this.ensureGraphics(this.homePanel);
    this.drawPanelBackground(homeBackground, 0, 40, 620, 520, new Color(10, 20, 34, 228));

    const resultBackground = this.ensureGraphics(this.resultPanel);
    this.drawPanelBackground(resultBackground, 0, -10, 640, 420, new Color(15, 18, 31, 230));

    this.homeTitleLabel = this.ensureLabelNode(this.homePanel, 'HomeTitle', 52);
    this.homeInfoLabel = this.ensureLabelNode(this.homePanel, 'HomeInfo', 28);
    this.homeToastLabel = this.ensureLabelNode(this.homePanel, 'HomeToast', 22);
    this.resultTitleLabel = this.ensureLabelNode(this.resultPanel, 'ResultTitle', 44);
    this.resultInfoLabel = this.ensureLabelNode(this.resultPanel, 'ResultInfo', 26);

    this.configureLabelNode(this.homeTitleLabel, new Vec3(0, 170, 0), HorizontalTextAlignment.CENTER, 520, 80, 52, 58);
    this.configureLabelNode(this.homeInfoLabel, new Vec3(0, 60, 0), HorizontalTextAlignment.CENTER, 520, 210, 28, 34);
    this.configureLabelNode(this.homeToastLabel, new Vec3(0, -155, 0), HorizontalTextAlignment.CENTER, 520, 70, 22, 28);
    this.configureLabelNode(this.resultTitleLabel, new Vec3(0, 130, 0), HorizontalTextAlignment.CENTER, 520, 70, 44, 50);
    this.configureLabelNode(this.resultInfoLabel, new Vec3(0, 25, 0), HorizontalTextAlignment.CENTER, 560, 180, 26, 32);

    this.homeButtons = [
      this.createButton(this.homePanel, 'StartButton', 'Start Run', new Vec3(0, -45, 0), 'start_run'),
      this.createButton(this.homePanel, 'RankButton', 'Rank (Soon)', new Vec3(-150, -115, 0), 'view_rank', { width: 220, height: 56 }),
      this.createButton(this.homePanel, 'NoticeButton', 'Notice (Soon)', new Vec3(150, -115, 0), 'view_notice', { width: 220, height: 56 })
    ];

    this.resultButtons = [
      this.createButton(this.resultPanel, 'ReviveButton', 'Revive', new Vec3(-155, -95, 0), 'revive', { width: 220, height: 58 }),
      this.createButton(this.resultPanel, 'DoubleButton', 'Double Coins', new Vec3(155, -95, 0), 'double_coin', { width: 220, height: 58 }),
      this.createButton(this.resultPanel, 'RestartButton', 'Restart', new Vec3(-155, -165, 0), 'restart', { width: 220, height: 58 }),
      this.createButton(this.resultPanel, 'HomeButton', 'Back Home', new Vec3(155, -165, 0), 'back_home', { width: 220, height: 58 })
    ];
  }

  private showHomeScreen(): void {
    this.phase = 'home';
    this.clearEntities();
    this.runState = null;
    this.lastSummary = null;
    this.busy = false;
    this.homePanel && (this.homePanel.active = true);
    this.resultPanel && (this.resultPanel.active = false);
    this.savedCoinBank = this.controller?.getSnapshot().coins ?? this.savedCoinBank;

    if (this.homeTitleLabel) {
      this.homeTitleLabel.string = 'SKI ENDLESS';
    }

    if (this.homeInfoLabel && this.controller) {
      const snapshot = this.controller.getSnapshot();
      this.homeInfoLabel.string = [
        `Welcome, user ${String(this.sessionUserId ?? 0)}`,
        `Best Distance: ${String(snapshot.bestDistance)}m`,
        `Best Score: ${String(snapshot.bestScore)}`,
        `Coin Bank: ${String(snapshot.coins)}`,
        '',
        'Single-player endless prototype',
        'One map, one mode, one revive, one double reward'
      ].join('\n');
    }

    if (this.homeToastLabel) {
      this.homeToastLabel.string = 'Tap Start to enter the slope';
    }

    this.hudLabel && (this.hudLabel.string = '');
    this.hintLabel &&
      (this.hintLabel.string = [
        'Home',
        '',
        'Start Run: enter gameplay',
        'Rank / Notice: placeholder entries',
        '',
        'This scene now acts as the player-facing home screen'
      ].join('\n'));
    this.resultLabel && (this.resultLabel.string = '');
  }

  private startNewRun(): void {
    if (!this.controller) {
      return;
    }

    const start = this.controller.startRun();
    this.phase = 'running';
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
    this.busy = false;
    this.clearEntities();
    this.homePanel && (this.homePanel.active = false);
    this.resultPanel && (this.resultPanel.active = false);
    this.resultLabel && (this.resultLabel.string = 'Run started');
    this.renderHint();
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

      if (this.runState && this.phase === 'running' && !this.runState.finished) {
        const isSameLane = entity.laneIndex === this.runState.laneIndex;
        const isNearPlayer = Math.abs(entity.y - PLAYER_Y) < entity.colliderRadius;

        if (isSameLane && isNearPlayer) {
          if (entity.kind === 'coin') {
            this.runState.coinsCollected += 1;
            entity.node.destroy();
            this.resultLabel && (this.resultLabel.string = `Coin collected\nrunCoins=${String(this.runState.coinsCollected)}`);
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
      this.phase = 'result';
      this.resultPanel && (this.resultPanel.active = true);
      this.homePanel && (this.homePanel.active = false);

      if (this.resultTitleLabel) {
        this.resultTitleLabel.string = 'Run Finished';
      }

      this.renderResultInfo(crashedBy);
      this.updateResultButtons();
      this.renderHud();
      this.renderHint();
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

      this.phase = 'running';
      this.runState.finished = false;
      this.runState.reviveUsed = true;
      this.runState.speed = Math.max(this.runState.baseSpeed, this.runState.speed * 0.72);
      this.entities.forEach((entity) => {
        if (Math.abs(entity.y - PLAYER_Y) < 140) {
          entity.node.destroy();
        }
      });
      this.entities = this.entities.filter((entity) => Math.abs(entity.y - PLAYER_Y) >= 140);
      this.resultPanel && (this.resultPanel.active = false);
      this.resultLabel && (this.resultLabel.string = `Revived\nverification=${verification.verificationId}`);
      this.renderHud();
      this.renderHint();
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
      this.savedCoinBank = reward.balanceAfter;
      this.renderResultInfo('reward_ad');
      this.resultInfoLabel &&
        (this.resultInfoLabel.string = [
          this.resultInfoLabel.string,
          '',
          'Double reward claimed',
          `rewardType=${reward.rewardType}`,
          `amount=${String(reward.amount)}`,
          `balanceAfter=${String(reward.balanceAfter)}`
        ].join('\n'));
      this.updateResultButtons();
    } finally {
      this.busy = false;
    }
  }

  private updateTrackVisuals(deltaTime: number): void {
    if (!this.runState || this.phase === 'home') {
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

    if (!this.runState || this.phase === 'home') {
      this.hudLabel.string = '';
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

    if (this.phase === 'home') {
      this.hintLabel.string = [
        'Home',
        '',
        'Tap Start Run to enter gameplay',
        'Touch left/right while playing to switch lanes',
        'Touch center to force finish',
        '',
        'Keyboard also works in preview'
      ].join('\n');
      return;
    }

    if (this.phase === 'result') {
      this.hintLabel.string = [
        'Result',
        '',
        'Revive: available once',
        'Double Coins: after finish',
        'Restart: immediate replay',
        'Back Home: return to menu',
        '',
        'Keyboard: V / C / R / H'
      ].join('\n');
      return;
    }

    this.hintLabel.string = [
      'Gameplay',
      '',
      'Desktop: A / D or Left / Right',
      'Mobile: tap left / right side',
      'Center tap or Space = finish run',
      '',
      'Avoid trees, rocks, gates',
      'Collect coins on safe lines'
    ].join('\n');
  }

  private renderResultInfo(crashedBy: string): void {
    if (!this.resultInfoLabel || !this.lastSummary || !this.runState) {
      return;
    }

    this.resultInfoLabel.string = [
      `Hit: ${crashedBy}`,
      `Distance: ${String(this.lastSummary.distance)}m`,
      `Score: ${String(this.lastSummary.score)}`,
      `Run Coins: ${String(this.lastSummary.coinsCollected)}`,
      `Saved Coin Bank: ${String(this.savedCoinBank)}`,
      `Best Distance: ${String(this.lastSummary.bestDistance)}m`,
      `Best Score: ${String(this.lastSummary.bestScore)}`,
      '',
      `Revive Used: ${String(this.runState.reviveUsed)}`,
      `Double Claimed: ${String(this.runState.doubleClaimed)}`
    ].join('\n');
  }

  private updateResultButtons(): void {
    if (!this.runState) {
      return;
    }

    this.setButtonEnabled(this.resultButtons, 'revive', !this.runState.reviveUsed);
    this.setButtonEnabled(this.resultButtons, 'double_coin', !this.runState.doubleClaimed && (this.lastSummary?.coinsCollected ?? 0) > 0);
    this.setButtonEnabled(this.resultButtons, 'restart', true);
    this.setButtonEnabled(this.resultButtons, 'back_home', true);
  }

  private applyDefaultLayout(): void {
    this.configureLabelNode(this.hudLabel, new Vec3(-480, 245, 0), HorizontalTextAlignment.LEFT, 360, 270, 26, 32);
    this.configureLabelNode(this.hintLabel, new Vec3(330, 225, 0), HorizontalTextAlignment.LEFT, 340, 300, 24, 30);
    this.configureLabelNode(this.resultLabel, new Vec3(-470, -220, 0), HorizontalTextAlignment.LEFT, 420, 160, 22, 28);

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

    this.skierNode.active = this.phase !== 'home';
    this.skierNode.setPosition(this.getLaneX(laneIndex, 0.98), PLAYER_Y, 0);
    this.skierNode.angle = -laneIndex * 6;
  }

  private tryHandleButtons(location: Vec2, buttons: UIButton[]): boolean {
    for (const button of buttons) {
      if (!button.enabled || !button.node.active) {
        continue;
      }

      const transform = button.node.getComponent(UITransform);
      if (!transform) {
        continue;
      }

      const rect = transform.getBoundingBoxToWorld();
      if (rect.contains(location)) {
        this.handleButtonAction(button.id);
        return true;
      }
    }

    return false;
  }

  private handleButtonAction(action: ButtonActionId): void {
    switch (action) {
      case 'start_run':
        this.startNewRun();
        break;
      case 'view_rank':
        this.homeToastLabel && (this.homeToastLabel.string = 'Rank page will be wired after gameplay polish.');
        break;
      case 'view_notice':
        this.homeToastLabel && (this.homeToastLabel.string = 'Notice page will be wired after gameplay polish.');
        break;
      case 'revive':
        void this.reviveRun();
        break;
      case 'double_coin':
        void this.claimDoubleCoins();
        break;
      case 'restart':
        this.startNewRun();
        break;
      case 'back_home':
        this.showHomeScreen();
        break;
      default:
        break;
    }
  }

  private setButtonEnabled(buttons: UIButton[], id: ButtonActionId, enabled: boolean): void {
    const target = buttons.find((button) => button.id === id);
    if (!target) {
      return;
    }

    target.enabled = enabled;
    this.drawButtonBackground(
      target.background,
      enabled ? new Color(45, 103, 214, 255) : new Color(72, 77, 90, 255),
      target.width,
      target.height
    );
    target.label.color = enabled ? new Color(255, 255, 255, 255) : new Color(185, 188, 196, 255);
  }

  private configureLabelNode(
    label: Label | null,
    position: Vec3,
    align: HorizontalTextAlignment,
    width: number,
    height: number,
    fontSize: number,
    lineHeight: number
  ): void {
    if (!label) {
      return;
    }

    label.node.setPosition(position);
    label.horizontalAlign = align;
    label.overflow = Label.Overflow.SHRINK;
    label.color = new Color(255, 255, 255, 255);
    label.fontSize = fontSize;
    label.lineHeight = lineHeight;

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

  private createButton(
    parent: Node,
    name: string,
    text: string,
    position: Vec3,
    id: ButtonActionId,
    size: { width: number; height: number } = { width: 300, height: 62 }
  ): UIButton {
    const node = this.ensureChildNode(parent, name, 12);
    node.setPosition(position);
    const transform = node.getComponent(UITransform) ?? node.addComponent(UITransform);
    transform.setContentSize(size.width, size.height);
    const background = this.ensureGraphics(node);
    this.drawButtonBackground(background, new Color(45, 103, 214, 255), size.width, size.height);

    const label = this.ensureLabelNode(node, `${name}Label`, 26);
    this.configureLabelNode(label, new Vec3(0, 0, 0), HorizontalTextAlignment.CENTER, size.width - 20, size.height - 10, 26, 30);
    label.string = text;

    return {
      id,
      node,
      background,
      label,
      width: size.width,
      height: size.height,
      enabled: true
    };
  }

  private drawButtonBackground(graphics: Graphics, color: Color, width = 300, height = 62): void {
    graphics.clear();
    graphics.fillColor = color;
    graphics.roundRect(-width / 2, -height / 2, width, height, 18);
    graphics.fill();
  }

  private drawPanelBackground(graphics: Graphics, x: number, y: number, width: number, height: number, color: Color): void {
    graphics.clear();
    graphics.fillColor = color;
    graphics.roundRect(x - width / 2, y - height / 2, width, height, 28);
    graphics.fill();

    graphics.strokeColor = new Color(255, 255, 255, 40);
    graphics.lineWidth = 3;
    graphics.roundRect(x - width / 2, y - height / 2, width, height, 28);
    graphics.stroke();
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
