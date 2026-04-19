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
import {
  SkiEndlessPrototypeController,
  type SkiLeaderboardEntry,
  type SkiNoticeItem,
  type SkiRunSummary
} from './SkiEndlessPrototypeController';

const { ccclass, property } = _decorator;

type LaneIndex = -1 | 0 | 1;
type EntityKind = 'obstacle' | 'coin';
type ObstacleType = 'tree' | 'rock' | 'gate';
type DifficultyStage = 'warmup' | 'flow' | 'rush' | 'whiteout';
type ScenePhase = 'home' | 'rank' | 'notice' | 'running' | 'result';
type ButtonActionId =
  | 'start_run'
  | 'view_rank'
  | 'view_notice'
  | 'revive'
  | 'double_coin'
  | 'restart'
  | 'back_home'
  | 'close_rank'
  | 'close_notice';

const PLAYER_Y = -235;
const SPAWN_Y = 470;
const DESPAWN_Y = -420;
const LANE_BASE_X = 185;
const TRACK_HALF_WIDTH_TOP = 230;
const TRACK_HALF_WIDTH_BOTTOM = 440;
const DISTANCE_FACTOR = 12;
const ENTITY_MOVE_FACTOR = 104;
const STRIPE_MOVE_FACTOR = 72;
const MIN_SPAWN_INTERVAL = 0.52;

interface ActiveRunState {
  mode: SkiModeKey;
  map: SkiMapKey;
  baseSpeed: number;
  maxSpeed: number;
  obstacleDensity: number;
  distance: number;
  speed: number;
  coinsCollected: number;
  laneIndex: LaneIndex;
  reviveUsed: boolean;
  doubleClaimed: boolean;
  finished: boolean;
  stage: DifficultyStage;
}

interface DifficultyProfile {
  stage: DifficultyStage;
  label: string;
  acceleration: number;
  speedCap: number;
  spawnInterval: number;
  twoObstacleChance: number;
  coinChance: number;
  bonusCoinChance: number;
  obstaclePool: ObstacleType[];
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

interface AmbientSnowParticle {
  node: Node;
  x: number;
  y: number;
  speed: number;
}

interface UIButton {
  id: ButtonActionId;
  node: Node;
  background: Graphics;
  label: Label;
  width: number;
  height: number;
  activeColor: Color;
  disabledColor: Color;
  enabled: boolean;
}

interface UIStatCard {
  id: string;
  node: Node;
  background: Graphics;
  titleLabel: Label;
  valueLabel: Label;
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
  private busy = false;
  private savedCoinBank = 0;
  private spawnTimer = 0;
  private entities: TrackEntity[] = [];
  private stripes: StripeVisual[] = [];
  private snowParticles: AmbientSnowParticle[] = [];
  private phase: ScenePhase = 'home';

  private canvasNode: Node | null = null;
  private backgroundRoot: Node | null = null;
  private itemRoot: Node | null = null;
  private overlayRoot: Node | null = null;
  private homePanel: Node | null = null;
  private rankPanel: Node | null = null;
  private noticePanel: Node | null = null;
  private resultPanel: Node | null = null;
  private homeTitleLabel: Label | null = null;
  private homeInfoLabel: Label | null = null;
  private homeToastLabel: Label | null = null;
  private homeBadgeLabel: Label | null = null;
  private rankTitleLabel: Label | null = null;
  private rankInfoLabel: Label | null = null;
  private noticeTitleLabel: Label | null = null;
  private noticeInfoLabel: Label | null = null;
  private resultTitleLabel: Label | null = null;
  private resultInfoLabel: Label | null = null;
  private hudPanelRoot: Node | null = null;

  private homeButtons: UIButton[] = [];
  private rankButtons: UIButton[] = [];
  private noticeButtons: UIButton[] = [];
  private resultButtons: UIButton[] = [];
  private hudCards: UIStatCard[] = [];
  private homeCards: UIStatCard[] = [];
  private resultCards: UIStatCard[] = [];

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
    const difficulty = this.getDifficultyProfile(run);
    if (run.stage !== difficulty.stage) {
      run.stage = difficulty.stage;
      this.resultLabel && (this.resultLabel.string = `${difficulty.label}\nThe slope is shifting.`);
    }

    run.speed = Math.min(difficulty.speedCap, run.speed + deltaTime * difficulty.acceleration);
    run.distance += run.speed * deltaTime * DISTANCE_FACTOR;

    this.spawnTimer += deltaTime;
    if (this.spawnTimer >= difficulty.spawnInterval) {
      this.spawnTimer = 0;
      this.spawnPattern(difficulty);
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

    if (this.phase === 'rank' || this.phase === 'notice') {
      switch (event.keyCode) {
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

    if (this.phase === 'rank') {
      if (this.tryHandleButtons(location, this.rankButtons)) {
        return;
      }
      return;
    }

    if (this.phase === 'notice') {
      if (this.tryHandleButtons(location, this.noticeButtons)) {
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
    this.snowParticles = [];

    const skyNode = this.createGraphicsNode('Sky', this.backgroundRoot, -5);
    this.drawRect(skyNode, 0, 150, 1280, 620, new Color(122, 181, 235, 255));

    const upperSkyNode = this.createGraphicsNode('UpperSky', this.backgroundRoot, -4);
    this.drawRect(upperSkyNode, 0, 285, 1280, 250, new Color(75, 137, 212, 255));

    const sunNode = this.createGraphicsNode('Sun', this.backgroundRoot, -3);
    const sunGraphics = this.ensureGraphics(sunNode);
    sunGraphics.clear();
    sunGraphics.fillColor = new Color(255, 238, 178, 255);
    sunGraphics.circle(390, 210, 56);
    sunGraphics.fill();

    const mountainFar = this.createGraphicsNode('MountainFar', this.backgroundRoot, -2);
    this.drawMountainRange(mountainFar, 118, 240, new Color(180, 204, 228, 255), [
      [-650, 20],
      [-500, 140],
      [-360, 50],
      [-180, 190],
      [20, 70],
      [180, 170],
      [360, 55],
      [520, 155],
      [650, 30]
    ]);

    const mountainNear = this.createGraphicsNode('MountainNear', this.backgroundRoot, -1);
    this.drawMountainRange(mountainNear, 72, 220, new Color(214, 230, 245, 255), [
      [-650, 0],
      [-520, 110],
      [-360, 40],
      [-240, 135],
      [-60, 30],
      [120, 120],
      [280, 28],
      [420, 132],
      [650, 10]
    ]);

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

    this.buildSideDecorations();
    this.buildAmbientSnow();

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

    this.hudPanelRoot = this.ensureChildNode(this.overlayRoot, 'HudPanelRoot', 2);
    this.homePanel = this.ensureChildNode(this.overlayRoot, 'HomePanel', 3);
    this.rankPanel = this.ensureChildNode(this.overlayRoot, 'RankPanel', 4);
    this.noticePanel = this.ensureChildNode(this.overlayRoot, 'NoticePanel', 5);
    this.resultPanel = this.ensureChildNode(this.overlayRoot, 'ResultPanel', 6);

    this.hudPanelRoot.removeAllChildren();
    const homeBackground = this.ensureGraphics(this.homePanel);
    this.drawPanelBackground(homeBackground, 0, 32, 650, 540, new Color(11, 23, 39, 232));
    const rankBackground = this.ensureGraphics(this.rankPanel);
    this.drawPanelBackground(rankBackground, 0, 28, 650, 540, new Color(11, 23, 39, 236));
    const noticeBackground = this.ensureGraphics(this.noticePanel);
    this.drawPanelBackground(noticeBackground, 0, 28, 650, 540, new Color(11, 23, 39, 236));

    const resultBackground = this.ensureGraphics(this.resultPanel);
    this.drawPanelBackground(resultBackground, 0, -6, 650, 438, new Color(14, 22, 36, 234));

    this.homeTitleLabel = this.ensureLabelNode(this.homePanel, 'HomeTitle', 52);
    this.homeBadgeLabel = this.ensureLabelNode(this.homePanel, 'HomeBadge', 20);
    this.homeInfoLabel = this.ensureLabelNode(this.homePanel, 'HomeInfo', 28);
    this.homeToastLabel = this.ensureLabelNode(this.homePanel, 'HomeToast', 22);
    this.rankTitleLabel = this.ensureLabelNode(this.rankPanel, 'RankTitle', 44);
    this.rankInfoLabel = this.ensureLabelNode(this.rankPanel, 'RankInfo', 24);
    this.noticeTitleLabel = this.ensureLabelNode(this.noticePanel, 'NoticeTitle', 44);
    this.noticeInfoLabel = this.ensureLabelNode(this.noticePanel, 'NoticeInfo', 24);
    this.resultTitleLabel = this.ensureLabelNode(this.resultPanel, 'ResultTitle', 44);
    this.resultInfoLabel = this.ensureLabelNode(this.resultPanel, 'ResultInfo', 26);

    this.configureLabelNode(this.homeTitleLabel, new Vec3(0, 178, 0), HorizontalTextAlignment.CENTER, 520, 80, 56, 62);
    this.configureLabelNode(this.homeBadgeLabel, new Vec3(0, 120, 0), HorizontalTextAlignment.CENTER, 430, 46, 20, 24);
    this.configureLabelNode(this.homeInfoLabel, new Vec3(0, -72, 0), HorizontalTextAlignment.CENTER, 560, 110, 24, 32);
    this.configureLabelNode(this.homeToastLabel, new Vec3(0, -206, 0), HorizontalTextAlignment.CENTER, 560, 60, 22, 28);
    this.configureLabelNode(this.rankTitleLabel, new Vec3(0, 186, 0), HorizontalTextAlignment.CENTER, 540, 70, 44, 50);
    this.configureLabelNode(this.rankInfoLabel, new Vec3(0, 4, 0), HorizontalTextAlignment.LEFT, 560, 330, 24, 30);
    this.configureLabelNode(this.noticeTitleLabel, new Vec3(0, 186, 0), HorizontalTextAlignment.CENTER, 540, 70, 44, 50);
    this.configureLabelNode(this.noticeInfoLabel, new Vec3(0, 4, 0), HorizontalTextAlignment.LEFT, 560, 330, 24, 30);
    this.configureLabelNode(this.resultTitleLabel, new Vec3(0, 140, 0), HorizontalTextAlignment.CENTER, 520, 70, 46, 52);
    this.configureLabelNode(this.resultInfoLabel, new Vec3(0, -16, 0), HorizontalTextAlignment.CENTER, 560, 150, 24, 30);

    this.homeButtons = [
      this.createButton(this.homePanel, 'StartButton', 'Start Run', new Vec3(0, -122, 0), 'start_run', { width: 320, height: 66 }, {
        activeColor: new Color(20, 152, 108, 255),
        disabledColor: new Color(77, 92, 92, 255)
      }),
      this.createButton(this.homePanel, 'RankButton', 'Leaderboard', new Vec3(-150, -184, 0), 'view_rank', { width: 220, height: 56 }, {
        activeColor: new Color(43, 87, 162, 255),
        disabledColor: new Color(77, 84, 97, 255)
      }),
      this.createButton(this.homePanel, 'NoticeButton', 'Notice', new Vec3(150, -184, 0), 'view_notice', { width: 220, height: 56 }, {
        activeColor: new Color(54, 99, 173, 255),
        disabledColor: new Color(77, 84, 97, 255)
      })
    ];

    this.rankButtons = [
      this.createButton(this.rankPanel, 'RankBackButton', 'Back Home', new Vec3(0, -186, 0), 'close_rank', { width: 240, height: 58 }, {
        activeColor: new Color(87, 95, 120, 255),
        disabledColor: new Color(77, 84, 97, 255)
      })
    ];

    this.noticeButtons = [
      this.createButton(this.noticePanel, 'NoticeBackButton', 'Back Home', new Vec3(0, -186, 0), 'close_notice', { width: 240, height: 58 }, {
        activeColor: new Color(87, 95, 120, 255),
        disabledColor: new Color(77, 84, 97, 255)
      })
    ];

    this.resultButtons = [
      this.createButton(this.resultPanel, 'ReviveButton', 'Revive', new Vec3(-155, -102, 0), 'revive', { width: 220, height: 58 }, {
        activeColor: new Color(245, 154, 33, 255),
        disabledColor: new Color(97, 89, 72, 255)
      }),
      this.createButton(this.resultPanel, 'DoubleButton', 'Double Coins', new Vec3(155, -102, 0), 'double_coin', { width: 220, height: 58 }, {
        activeColor: new Color(47, 113, 224, 255),
        disabledColor: new Color(77, 84, 97, 255)
      }),
      this.createButton(this.resultPanel, 'RestartButton', 'Restart', new Vec3(-155, -174, 0), 'restart', { width: 220, height: 58 }, {
        activeColor: new Color(31, 163, 134, 255),
        disabledColor: new Color(77, 84, 97, 255)
      }),
      this.createButton(this.resultPanel, 'HomeButton', 'Back Home', new Vec3(155, -174, 0), 'back_home', { width: 220, height: 58 }, {
        activeColor: new Color(87, 95, 120, 255),
        disabledColor: new Color(77, 84, 97, 255)
      })
    ];

    this.hudCards = [
      this.createStatCard(this.hudPanelRoot, 'DistanceCard', 'Distance', new Vec3(-245, 292, 0), new Color(52, 116, 215, 230), { width: 210, height: 84 }, 'distance'),
      this.createStatCard(this.hudPanelRoot, 'CoinCard', 'Coins', new Vec3(0, 292, 0), new Color(221, 162, 37, 230), { width: 210, height: 84 }, 'coins'),
      this.createStatCard(this.hudPanelRoot, 'SpeedCard', 'Speed', new Vec3(245, 292, 0), new Color(36, 152, 126, 230), { width: 210, height: 84 }, 'speed')
    ];

    this.homeCards = [
      this.createStatCard(this.homePanel, 'HomeBestDistanceCard', 'Best Distance', new Vec3(-190, 26, 0), new Color(52, 116, 215, 230), { width: 180, height: 82 }),
      this.createStatCard(this.homePanel, 'HomeCoinBankCard', 'Coin Bank', new Vec3(0, 26, 0), new Color(221, 162, 37, 230), { width: 180, height: 82 }),
      this.createStatCard(this.homePanel, 'HomeBestScoreCard', 'Best Score', new Vec3(190, 26, 0), new Color(36, 152, 126, 230), { width: 180, height: 82 })
    ];

    this.resultCards = [
      this.createStatCard(this.resultPanel, 'ResultDistanceCard', 'Distance', new Vec3(-190, 58, 0), new Color(52, 116, 215, 230), { width: 180, height: 82 }),
      this.createStatCard(this.resultPanel, 'ResultCoinCard', 'Run Coins', new Vec3(0, 58, 0), new Color(221, 162, 37, 230), { width: 180, height: 82 }),
      this.createStatCard(this.resultPanel, 'ResultBestCard', 'Best', new Vec3(190, 58, 0), new Color(36, 152, 126, 230), { width: 180, height: 82 })
    ];
  }

  private showHomeScreen(): void {
    this.phase = 'home';
    this.clearEntities();
    this.runState = null;
    this.lastSummary = null;
    this.busy = false;
    this.homePanel && (this.homePanel.active = true);
    this.rankPanel && (this.rankPanel.active = false);
    this.noticePanel && (this.noticePanel.active = false);
    this.resultPanel && (this.resultPanel.active = false);
    this.savedCoinBank = this.controller?.getSnapshot().coins ?? this.savedCoinBank;
    this.skierNode && (this.skierNode.active = false);

    if (this.homeTitleLabel) {
      this.homeTitleLabel.string = 'SKI ENDLESS';
    }

    if (this.homeBadgeLabel) {
      this.homeBadgeLabel.string = 'SNOWFIELD   /   ENDLESS   /   SOLO';
      this.homeBadgeLabel.color = new Color(194, 223, 246, 255);
    }

    if (this.homeInfoLabel && this.controller) {
      const snapshot = this.controller.getSnapshot();
      this.setStatCardValueByList(this.homeCards, 'HomeBestDistanceCard', `${String(snapshot.bestDistance)}m`);
      this.setStatCardValueByList(this.homeCards, 'HomeCoinBankCard', `${String(snapshot.coins)}`);
      this.setStatCardValueByList(this.homeCards, 'HomeBestScoreCard', `${String(snapshot.bestScore)}`);
      this.homeInfoLabel.string = [
        `Welcome back, Rider ${String(this.sessionUserId ?? 0)}`,
        '',
        'Snowfield Endless is live.',
        'Clean lane reads matter more than raw speed.'
      ].join('\n');
    }

    if (this.homeToastLabel) {
      this.homeToastLabel.string = 'Start a run, check the live board, or read current mountain updates.';
    }

    this.hudLabel && (this.hudLabel.string = '');
    this.hudPanelRoot && (this.hudPanelRoot.active = false);
    this.hintLabel &&
      (this.hintLabel.string = [
        'Tap Start to hit the slope',
        '',
        'Touch left / right while playing',
        'to switch lanes around obstacles.'
      ].join('\n'));
    this.resultLabel && (this.resultLabel.string = '');
  }

  private startNewRun(): void {
    if (!this.controller) {
      return;
    }

    const start = this.controller.startRun();
    const initialStage: DifficultyStage = 'warmup';
    this.phase = 'running';
    this.runState = {
      mode: start.mode,
      map: start.map,
      baseSpeed: start.baseSpeed,
      maxSpeed: start.maxSpeed,
      obstacleDensity: start.obstacleDensity,
      distance: 0,
      speed: start.baseSpeed,
      coinsCollected: 0,
      laneIndex: 0,
      reviveUsed: false,
      doubleClaimed: false,
      finished: false,
      stage: initialStage
    };
    this.lastSummary = null;
    this.spawnTimer = 0;
    this.busy = false;
    this.clearEntities();
    this.homePanel && (this.homePanel.active = false);
    this.rankPanel && (this.rankPanel.active = false);
    this.noticePanel && (this.noticePanel.active = false);
    this.resultPanel && (this.resultPanel.active = false);
    this.hudPanelRoot && (this.hudPanelRoot.active = true);
    this.resultLabel && (this.resultLabel.string = 'Warm-up\nWide lanes and easy lines.');
    this.renderHint();
    this.updateSkierVisual(0);
    this.renderHud();
  }

  private async showRankScreen(): Promise<void> {
    if (!this.controller) {
      return;
    }

    this.phase = 'rank';
    this.clearEntities();
    this.runState = null;
    this.homePanel && (this.homePanel.active = false);
    this.noticePanel && (this.noticePanel.active = false);
    this.resultPanel && (this.resultPanel.active = false);
    this.rankPanel && (this.rankPanel.active = true);
    this.hudPanelRoot && (this.hudPanelRoot.active = false);
    this.skierNode && (this.skierNode.active = false);

    if (this.rankTitleLabel) {
      this.rankTitleLabel.string = 'SNOWFIELD LEADERBOARD';
    }

    if (this.rankInfoLabel) {
      this.rankInfoLabel.string = 'Loading top riders...\n\nStand by while the board syncs.';
    }

    this.resultLabel && (this.resultLabel.string = '');
    this.renderHint();

    try {
      const leaderboard = await this.controller.getLeaderboard(8);

      if (this.phase !== 'rank' || !this.rankInfoLabel) {
        return;
      }

      this.rankInfoLabel.string = this.formatLeaderboard(leaderboard.items, leaderboard.currentUser);
    } catch (error) {
      if (this.phase !== 'rank' || !this.rankInfoLabel) {
        return;
      }

      this.rankInfoLabel.string = `Unable to load leaderboard.\n\n${this.formatErrorMessage(error)}`;
    }
  }

  private async showNoticeScreen(): Promise<void> {
    if (!this.controller) {
      return;
    }

    this.phase = 'notice';
    this.clearEntities();
    this.runState = null;
    this.homePanel && (this.homePanel.active = false);
    this.rankPanel && (this.rankPanel.active = false);
    this.resultPanel && (this.resultPanel.active = false);
    this.noticePanel && (this.noticePanel.active = true);
    this.hudPanelRoot && (this.hudPanelRoot.active = false);
    this.skierNode && (this.skierNode.active = false);

    if (this.noticeTitleLabel) {
      this.noticeTitleLabel.string = 'MOUNTAIN NOTICE';
    }

    if (this.noticeInfoLabel) {
      this.noticeInfoLabel.string = 'Loading notice board...\n\nStand by while the mountain desk checks updates.';
    }

    this.resultLabel && (this.resultLabel.string = '');
    this.renderHint();

    try {
      const noticeList = await this.controller.getNotices();

      if (this.phase !== 'notice' || !this.noticeInfoLabel) {
        return;
      }

      this.noticeInfoLabel.string = this.formatNoticeList(noticeList.items);
    } catch (error) {
      if (this.phase !== 'notice' || !this.noticeInfoLabel) {
        return;
      }

      this.noticeInfoLabel.string = `Unable to load notices.\n\n${this.formatErrorMessage(error)}`;
    }
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

  private spawnPattern(profile: DifficultyProfile): void {
    if (!this.itemRoot || !this.runState) {
      return;
    }

    const lanes: LaneIndex[] = [-1, 0, 1].sort(() => Math.random() - 0.5) as LaneIndex[];
    const obstacleCount = Math.random() < profile.twoObstacleChance ? 2 : 1;

    for (let index = 0; index < obstacleCount; index += 1) {
      const lane = lanes[index];
      const obstacleType = profile.obstaclePool[Math.floor(Math.random() * profile.obstaclePool.length)] ?? 'tree';
      this.spawnEntity('obstacle', lane, SPAWN_Y + index * 34, obstacleType);
    }

    const safeLanes = lanes.filter((lane) => !lanes.slice(0, obstacleCount).includes(lane));
    const primaryCoinLane = safeLanes[0];
    if (primaryCoinLane !== undefined && Math.random() < profile.coinChance) {
      this.spawnEntity('coin', primaryCoinLane, SPAWN_Y + 78);
    }

    const bonusCoinLane = safeLanes[1];
    if (bonusCoinLane !== undefined && Math.random() < profile.bonusCoinChance) {
      this.spawnEntity('coin', bonusCoinLane, SPAWN_Y + 126);
    }
  }

  private getDifficultyProfile(run: ActiveRunState): DifficultyProfile {
    const density = Math.max(0.78, Math.min(1.08, run.obstacleDensity || 1));

    if (run.distance < 260) {
      return {
        stage: 'warmup',
        label: 'Warm-up',
        acceleration: 0.16,
        speedCap: Math.min(run.maxSpeed, run.baseSpeed + 0.9),
        spawnInterval: Math.max(MIN_SPAWN_INTERVAL, 1.16 / density),
        twoObstacleChance: 0.05,
        coinChance: 0.88,
        bonusCoinChance: 0.18,
        obstaclePool: ['tree', 'rock']
      };
    }

    if (run.distance < 760) {
      return {
        stage: 'flow',
        label: 'Flow',
        acceleration: 0.22,
        speedCap: Math.min(run.maxSpeed, run.baseSpeed + 2.0),
        spawnInterval: Math.max(MIN_SPAWN_INTERVAL, 0.98 / density),
        twoObstacleChance: 0.2,
        coinChance: 0.75,
        bonusCoinChance: 0.22,
        obstaclePool: ['tree', 'rock', 'gate']
      };
    }

    if (run.distance < 1500) {
      return {
        stage: 'rush',
        label: 'Rush',
        acceleration: 0.28,
        speedCap: Math.min(run.maxSpeed, run.baseSpeed + 3.4),
        spawnInterval: Math.max(MIN_SPAWN_INTERVAL, 0.82 / density),
        twoObstacleChance: 0.38,
        coinChance: 0.62,
        bonusCoinChance: 0.18,
        obstaclePool: ['tree', 'rock', 'gate']
      };
    }

    return {
      stage: 'whiteout',
      label: 'Whiteout',
      acceleration: 0.32,
      speedCap: run.maxSpeed,
      spawnInterval: Math.max(MIN_SPAWN_INTERVAL, 0.72 / density),
      twoObstacleChance: 0.52,
      coinChance: 0.48,
      bonusCoinChance: 0.14,
      obstaclePool: ['tree', 'rock', 'gate']
    };
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
    const moveDelta = speed * deltaTime * ENTITY_MOVE_FACTOR;
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
      this.rankPanel && (this.rankPanel.active = false);
      this.noticePanel && (this.noticePanel.active = false);
      this.hudPanelRoot && (this.hudPanelRoot.active = true);

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
      this.hudPanelRoot && (this.hudPanelRoot.active = true);
      this.skierNode && (this.skierNode.active = true);
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

    const stripeDelta = this.runState.speed * deltaTime * STRIPE_MOVE_FACTOR;
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

    for (const particle of this.snowParticles) {
      particle.y -= particle.speed * deltaTime;
      if (particle.y < -380) {
        particle.y = 390 + Math.random() * 120;
      }
      particle.node.setPosition(particle.x, particle.y, 0);
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
      `Rider ${String(this.sessionUserId ?? 0)}`,
      `pace ${this.runState.stage}`,
      `line ${this.runState.laneIndex === -1 ? 'left' : this.runState.laneIndex === 1 ? 'right' : 'center'}`,
      `revive ${this.runState.reviveUsed ? 'used' : 'ready'}`
    ].join('\n');

    this.setStatCardValue('distance', `${String(Math.floor(this.runState.distance))}m`);
    this.setStatCardValue('coins', `${String(this.runState.coinsCollected)}`);
    this.setStatCardValue('speed', `${this.runState.speed.toFixed(1)}x`);
  }

  private renderHint(): void {
    if (!this.hintLabel) {
      return;
    }

    if (this.phase === 'home') {
      this.hintLabel.string = [
        'Tap Start Run to enter gameplay',
        'Swipe or tap left / right to switch lanes',
        '',
        'Keep a clean line and hold your nerve.'
      ].join('\n');
      return;
    }

    if (this.phase === 'rank') {
      this.hintLabel.string = [
        'Review the top snowfield runs.',
        '',
        'Tap Back Home when you are ready',
        'to head back onto the slope.'
      ].join('\n');
      return;
    }

    if (this.phase === 'notice') {
      this.hintLabel.string = [
        'Check current mountain updates,',
        'mode status, and live notices.',
        '',
        'Tap Back Home to return.'
      ].join('\n');
      return;
    }

    if (this.phase === 'result') {
      this.hintLabel.string = [
        'Revive once, double your coins,',
        'or jump straight into the next run.',
        '',
        'Keyboard: V / C / R / H'
      ].join('\n');
      return;
    }

    this.hintLabel.string = [
        `Pace: ${this.runState?.stage ?? 'warmup'}`,
        'Desktop: A / D or Left / Right',
        'Mobile: tap left / right edge',
        '',
        'Read the safe lane first,',
        'then take coins on clean lines.'
    ].join('\n');
  }

  private renderResultInfo(crashedBy: string): void {
    if (!this.resultInfoLabel || !this.lastSummary || !this.runState) {
      return;
    }

    this.setStatCardValueByList(this.resultCards, 'ResultDistanceCard', `${String(this.lastSummary.distance)}m`);
    this.setStatCardValueByList(this.resultCards, 'ResultCoinCard', `${String(this.lastSummary.coinsCollected)}`);
    this.setStatCardValueByList(this.resultCards, 'ResultBestCard', `${String(this.lastSummary.bestDistance)}m`);

    this.resultInfoLabel.string = [
      `Impact: ${crashedBy}`,
      `Score ${String(this.lastSummary.score)}   Coin Bank ${String(this.savedCoinBank)}`,
      '',
      `Revive Used  ${String(this.runState.reviveUsed)}`,
      `Double Coins ${String(this.runState.doubleClaimed)}`
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
    this.configureLabelNode(this.hudLabel, new Vec3(-520, 210, 0), HorizontalTextAlignment.LEFT, 280, 170, 20, 24);
    this.configureLabelNode(this.hintLabel, new Vec3(390, -230, 0), HorizontalTextAlignment.RIGHT, 360, 170, 22, 28);
    this.configureLabelNode(this.resultLabel, new Vec3(0, -308, 0), HorizontalTextAlignment.CENTER, 500, 80, 20, 24);

    if (this.hudLabel) {
      this.hudLabel.color = new Color(222, 236, 247, 210);
    }

    if (this.hintLabel) {
      this.hintLabel.color = new Color(232, 241, 248, 215);
    }

    if (this.resultLabel) {
      this.resultLabel.color = new Color(255, 243, 211, 235);
    }

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
        void this.showRankScreen();
        break;
      case 'view_notice':
        void this.showNoticeScreen();
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
      case 'close_rank':
        this.showHomeScreen();
        break;
      case 'close_notice':
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
      enabled ? target.activeColor : target.disabledColor,
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

  private formatLeaderboard(items: SkiLeaderboardEntry[], currentUser: SkiLeaderboardEntry | null): string {
    if (items.length === 0) {
      return [
        'No distance records yet.',
        '',
        'Run the mountain once and',
        'the first leaderboard entry will appear here.'
      ].join('\n');
    }

    const topRows = items.map((entry) => {
      const rank = `#${String(entry.rank).padStart(2, '0')}`;
      const nickname = entry.nickname.padEnd(12, ' ').slice(0, 12);
      return `${rank}  ${nickname}  ${String(entry.bestDistance).padStart(4, ' ')}m`;
    });

    if (!currentUser) {
      return [
        'Top Distance',
        '',
        ...topRows
      ].join('\n');
    }

    return [
      'Top Distance',
      '',
      ...topRows,
      '',
      `You: #${String(currentUser.rank)}  ${currentUser.bestDistance}m  (${currentUser.nickname})`
    ].join('\n');
  }

  private formatNoticeList(items: SkiNoticeItem[]): string {
    if (items.length === 0) {
      return [
        'No live notices.',
        '',
        'When a new mountain update is published,',
        'it will appear here.'
      ].join('\n');
    }

    return items
      .slice(0, 3)
      .map((item) =>
        [
          item.title,
          this.formatTimestamp(item.updatedAt),
          item.content
        ].join('\n')
      )
      .join('\n\n');
  }

  private formatTimestamp(timestamp: number): string {
    const date = new Date(timestamp);
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    const hours = String(date.getHours()).padStart(2, '0');
    const minutes = String(date.getMinutes()).padStart(2, '0');
    return `${month}-${day} ${hours}:${minutes}`;
  }

  private formatErrorMessage(error: unknown): string {
    if (error instanceof Error && error.message.trim() !== '') {
      return error.message;
    }

    return 'Unknown error';
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
    size: { width: number; height: number } = { width: 300, height: 62 },
    palette: { activeColor: Color; disabledColor: Color } = {
      activeColor: new Color(45, 103, 214, 255),
      disabledColor: new Color(72, 77, 90, 255)
    }
  ): UIButton {
    const node = this.ensureChildNode(parent, name, 12);
    node.setPosition(position);
    const transform = node.getComponent(UITransform) ?? node.addComponent(UITransform);
    transform.setContentSize(size.width, size.height);
    const background = this.ensureGraphics(node);
    this.drawButtonBackground(background, palette.activeColor, size.width, size.height);

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
      activeColor: palette.activeColor,
      disabledColor: palette.disabledColor,
      enabled: true
    };
  }

  private createStatCard(
    parent: Node,
    name: string,
    title: string,
    position: Vec3,
    color: Color,
    size: { width: number; height: number } = { width: 210, height: 84 },
    cardId = name
  ): UIStatCard {
    const node = this.ensureChildNode(parent, name, 1);
    node.setPosition(position);
    const transform = node.getComponent(UITransform) ?? node.addComponent(UITransform);
    transform.setContentSize(size.width, size.height);
    const background = this.ensureGraphics(node);
    this.drawStatCard(background, color, size.width, size.height);

    const titleLabel = this.ensureLabelNode(node, `${name}Title`, 18);
    const valueLabel = this.ensureLabelNode(node, `${name}Value`, 28);
    this.configureLabelNode(titleLabel, new Vec3(0, 18, 0), HorizontalTextAlignment.CENTER, size.width - 30, 28, 18, 22);
    this.configureLabelNode(valueLabel, new Vec3(0, -14, 0), HorizontalTextAlignment.CENTER, size.width - 30, 36, 28, 32);
    titleLabel.color = new Color(226, 239, 250, 220);
    valueLabel.color = new Color(255, 255, 255, 255);
    titleLabel.string = title;
    valueLabel.string = '--';

    return {
      id: cardId,
      node,
      background,
      titleLabel,
      valueLabel
    };
  }

  private setStatCardValue(id: UIStatCard['id'], value: string): void {
    const card = this.hudCards.find((item) => item.id === id);
    if (!card) {
      return;
    }

    card.valueLabel.string = value;
  }

  private setStatCardValueByList(cards: UIStatCard[], id: string, value: string): void {
    const card = cards.find((item) => item.id === id);
    if (!card) {
      return;
    }

    card.valueLabel.string = value;
  }

  private drawButtonBackground(graphics: Graphics, color: Color, width = 300, height = 62): void {
    graphics.clear();
    graphics.fillColor = color;
    graphics.roundRect(-width / 2, -height / 2, width, height, 18);
    graphics.fill();

    graphics.fillColor = new Color(255, 255, 255, 24);
    graphics.roundRect(-width / 2, 2, width, height / 2 - 6, 18);
    graphics.fill();
  }

  private drawStatCard(graphics: Graphics, color: Color, width = 210, height = 84): void {
    const halfWidth = width / 2;
    const halfHeight = height / 2;
    graphics.clear();
    graphics.fillColor = new Color(15, 24, 39, 175);
    graphics.roundRect(-halfWidth, -halfHeight, width, height, 22);
    graphics.fill();

    graphics.fillColor = color;
    graphics.roundRect(-halfWidth, halfHeight - 26, width, 26, 22);
    graphics.fill();

    graphics.strokeColor = new Color(255, 255, 255, 34);
    graphics.lineWidth = 2;
    graphics.roundRect(-halfWidth, -halfHeight, width, height, 22);
    graphics.stroke();
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

  private drawMountainRange(
    node: Node,
    baseY: number,
    heightOffset: number,
    color: Color,
    points: Array<[number, number]>
  ): void {
    const graphics = this.ensureGraphics(node);
    graphics.clear();
    graphics.fillColor = color;
    graphics.moveTo(points[0]?.[0] ?? -640, baseY - heightOffset);
    points.forEach(([x, y]) => {
      graphics.lineTo(x, baseY + y - heightOffset);
    });
    graphics.lineTo(points[points.length - 1]?.[0] ?? 640, baseY - heightOffset);
    graphics.lineTo(points[0]?.[0] ?? -640, baseY - heightOffset);
    graphics.close();
    graphics.fill();
  }

  private buildSideDecorations(): void {
    if (!this.backgroundRoot) {
      return;
    }

    for (let index = 0; index < 5; index += 1) {
      const leftTree = this.createGraphicsNode(`DecorTreeLeft-${index}`, this.backgroundRoot, 4);
      const rightTree = this.createGraphicsNode(`DecorTreeRight-${index}`, this.backgroundRoot, 4);
      const y = 250 - index * 125;
      const scale = 0.8 + index * 0.08;

      this.drawObstacle(this.ensureGraphics(leftTree), 'tree');
      this.drawObstacle(this.ensureGraphics(rightTree), 'tree');
      leftTree.setPosition(-500 + index * 14, y, 0);
      rightTree.setPosition(500 - index * 16, y + 25, 0);
      leftTree.setScale(scale, scale, 1);
      rightTree.setScale(scale * 0.95, scale * 0.95, 1);
    }

    const snowDriftLeft = this.createGraphicsNode('SnowDriftLeft', this.backgroundRoot, 5);
    const snowDriftRight = this.createGraphicsNode('SnowDriftRight', this.backgroundRoot, 5);
    this.drawSnowDrift(snowDriftLeft, -530);
    this.drawSnowDrift(snowDriftRight, 530);
  }

  private buildAmbientSnow(): void {
    if (!this.backgroundRoot) {
      return;
    }

    for (let index = 0; index < 22; index += 1) {
      const node = this.createGraphicsNode(`SnowParticle-${index}`, this.backgroundRoot, 6);
      const graphics = this.ensureGraphics(node);
      const radius = 2 + (index % 4);
      graphics.clear();
      graphics.fillColor = new Color(255, 255, 255, 120 + (index % 3) * 30);
      graphics.circle(0, 0, radius);
      graphics.fill();

      this.snowParticles.push({
        node,
        x: -560 + Math.random() * 1120,
        y: -320 + Math.random() * 760,
        speed: 26 + Math.random() * 38
      });
    }
  }

  private drawSnowDrift(node: Node, centerX: number): void {
    const graphics = this.ensureGraphics(node);
    graphics.clear();
    graphics.fillColor = new Color(250, 252, 255, 170);
    graphics.circle(centerX, -260, 120);
    graphics.fill();
    graphics.circle(centerX + (centerX < 0 ? 55 : -55), -220, 84);
    graphics.fill();
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
