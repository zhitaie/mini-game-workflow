import {
  _decorator,
  Canvas,
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
  ResolutionPolicy,
  Sprite,
  SpriteFrame,
  UITransform,
  Vec2,
  Vec3,
  input,
  resources,
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
import { SkiAudioDirector } from './SkiAudioDirector';

const { ccclass, property } = _decorator;

type LaneIndex = -1 | 0 | 1;
type EntityKind = 'obstacle' | 'coin';
type ObstacleType = 'tree' | 'rock' | 'gate';
type DifficultyStage = 'warmup' | 'flow' | 'rush' | 'whiteout';
type ScenePhase = 'home' | 'rank' | 'notice' | 'settings' | 'running' | 'result';
type ButtonActionId =
  | 'start_run'
  | 'view_rank'
  | 'view_notice'
  | 'view_settings'
  | 'revive'
  | 'double_coin'
  | 'restart'
  | 'back_home'
  | 'close_rank'
  | 'close_notice'
  | 'close_settings'
  | 'toggle_audio'
  | 'toggle_snow_fx'
  | 'toggle_assist'
  | 'toggle_coach';

const PLAYER_Y = -430;
const TRACK_HORIZON_Y = 156;
const TRACK_NEAR_Y = -690;
const TRACK_HALF_WIDTH_FAR = 56;
const TRACK_HALF_WIDTH_NEAR = 308;
const LANE_SPREAD_FAR = 34;
const LANE_SPREAD_NEAR = 178;
const PLAYER_COLLISION_DEPTH = 0.78;
const DISTANCE_FACTOR = 12;
const ENTITY_DEPTH_FACTOR = 0.066;
const STRIPE_DEPTH_FACTOR = 0.058;
const ROADSIDE_DEPTH_FACTOR = 0.054;
const MIN_SPAWN_INTERVAL = 0.52;
const PREFERENCES_STORAGE_KEY = 'ski-endless-local-preferences-v1';

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
  depth: number;
  node: Node;
  colliderRadius: number;
  pulseOffset: number;
}

interface StripeVisual {
  node: Node;
  depth: number;
}

interface AmbientSnowParticle {
  node: Node;
  x: number;
  y: number;
  speed: number;
}

interface RoadsideDecoration {
  node: Node;
  side: -1 | 1;
  obstacleType: 'tree' | 'rock';
  depth: number;
  lateralOffset: number;
  pulseOffset: number;
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

interface SkiLocalPreferences {
  audioEnabled: boolean;
  snowFxEnabled: boolean;
  assistLinesEnabled: boolean;
  coachTipsEnabled: boolean;
}

interface SkiVisualFrameMap {
  background: SpriteFrame | null;
  player: SpriteFrame | null;
  coin: SpriteFrame | null;
  tree: SpriteFrame | null;
  rock: SpriteFrame | null;
  gate: SpriteFrame | null;
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
  private roadsideDecorations: RoadsideDecoration[] = [];
  private phase: ScenePhase = 'home';

  private canvasNode: Node | null = null;
  private backgroundRoot: Node | null = null;
  private itemRoot: Node | null = null;
  private overlayRoot: Node | null = null;
  private homePanel: Node | null = null;
  private rankPanel: Node | null = null;
  private noticePanel: Node | null = null;
  private settingsPanel: Node | null = null;
  private resultPanel: Node | null = null;
  private homeTitleLabel: Label | null = null;
  private homeInfoLabel: Label | null = null;
  private homeToastLabel: Label | null = null;
  private homeBadgeLabel: Label | null = null;
  private rankTitleLabel: Label | null = null;
  private rankInfoLabel: Label | null = null;
  private noticeTitleLabel: Label | null = null;
  private noticeInfoLabel: Label | null = null;
  private settingsTitleLabel: Label | null = null;
  private settingsInfoLabel: Label | null = null;
  private resultTitleLabel: Label | null = null;
  private resultInfoLabel: Label | null = null;
  private hudPanelRoot: Node | null = null;

  private homeButtons: UIButton[] = [];
  private rankButtons: UIButton[] = [];
  private noticeButtons: UIButton[] = [];
  private settingsButtons: UIButton[] = [];
  private resultButtons: UIButton[] = [];
  private hudCards: UIStatCard[] = [];
  private homeCards: UIStatCard[] = [];
  private resultCards: UIStatCard[] = [];
  private laneGuideNodes: Node[] = [];
  private preferences: SkiLocalPreferences = {
    audioEnabled: true,
    snowFxEnabled: true,
    assistLinesEnabled: true,
    coachTipsEnabled: true
  };
  private readonly audioDirector = new SkiAudioDirector();
  private readonly visualFrames: SkiVisualFrameMap = {
    background: null,
    player: null,
    coin: null,
    tree: null,
    rock: null,
    gate: null
  };
  private visualsRequested = false;
  private animationClock = 0;

  start(): void {
    const runtimeSession = SkiRuntimeSessionStore.get();

    if (!runtimeSession) {
      this.renderFatal('Runtime session missing. Return to Boot scene first.');
      return;
    }

    this.sessionUserId = runtimeSession.session.user.id;
    this.controller = new SkiEndlessPrototypeController(runtimeSession.runtime);
    this.savedCoinBank = this.controller.getSnapshot().coins;
    this.loadPreferences();
    this.audioDirector.setAudioEnabled(this.preferences.audioEnabled);
    this.ensureSceneNodes();
    this.applyPortraitPresentation();
    this.applyDefaultLayout();
    this.buildTrackVisuals();
    this.buildPanels();
    this.renderHint();
    this.showHomeScreen();
    void this.loadVisualAssets();

    input.on(Input.EventType.KEY_DOWN, this.onKeyDown, this);
    input.on(Input.EventType.TOUCH_START, this.onTouchStart, this);
  }

  onDestroy(): void {
    input.off(Input.EventType.KEY_DOWN, this.onKeyDown, this);
    input.off(Input.EventType.TOUCH_START, this.onTouchStart, this);
    this.audioDirector.dispose();
  }

  update(deltaTime: number): void {
    this.animationClock += deltaTime;
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
    this.audioDirector.unlock();

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

    if (this.phase === 'rank' || this.phase === 'notice' || this.phase === 'settings') {
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
    this.audioDirector.unlock();

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

    if (this.phase === 'settings') {
      if (this.tryHandleButtons(location, this.settingsButtons)) {
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

  private applyPortraitPresentation(): void {
    if (this.canvasNode) {
      const canvas = this.canvasNode.getComponent(Canvas);
      if (canvas) {
        (canvas as Canvas & { fitWidth?: boolean; fitHeight?: boolean }).fitWidth = true;
        (canvas as Canvas & { fitWidth?: boolean; fitHeight?: boolean }).fitHeight = false;
      }
    }

    const viewApi = view as unknown as {
      setDesignResolutionSize?: (width: number, height: number, policy: number) => void;
    };
    viewApi.setDesignResolutionSize?.(720, 1280, ResolutionPolicy.FIXED_WIDTH);
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
    this.laneGuideNodes = [];
    this.roadsideDecorations = [];

    if (this.visualFrames.background) {
      this.createBackgroundSprite(this.backgroundRoot, this.visualFrames.background);
      const tintNode = this.createGraphicsNode('BackdropTint', this.backgroundRoot, -4);
      this.drawRect(tintNode, 0, 0, 760, 1320, new Color(19, 62, 114, 34));
    } else {
      const skyNode = this.createGraphicsNode('Sky', this.backgroundRoot, -5);
      this.drawRect(skyNode, 0, 150, 840, 1480, new Color(122, 181, 235, 255));

      const upperSkyNode = this.createGraphicsNode('UpperSky', this.backgroundRoot, -4);
      this.drawRect(upperSkyNode, 0, 410, 840, 460, new Color(75, 137, 212, 255));

      const sunNode = this.createGraphicsNode('Sun', this.backgroundRoot, -3);
      const sunGraphics = this.ensureGraphics(sunNode);
      sunGraphics.clear();
      sunGraphics.fillColor = new Color(255, 238, 178, 255);
      sunGraphics.circle(238, 350, 56);
      sunGraphics.fill();

      const mountainFar = this.createGraphicsNode('MountainFar', this.backgroundRoot, -2);
      this.drawMountainRange(mountainFar, 220, 260, new Color(180, 204, 228, 255), [
        [-420, 10],
        [-320, 170],
        [-250, 70],
        [-120, 230],
        [0, 95],
        [120, 215],
        [260, 80],
        [340, 188],
        [420, 24]
      ]);

      const mountainNear = this.createGraphicsNode('MountainNear', this.backgroundRoot, -1);
      this.drawMountainRange(mountainNear, 170, 210, new Color(214, 230, 245, 255), [
        [-420, 0],
        [-330, 112],
        [-230, 42],
        [-80, 138],
        [40, 36],
        [170, 122],
        [280, 24],
        [360, 118],
        [420, 8]
      ]);
    }

    const lowerSnowfield = this.createGraphicsNode('LowerSnowfield', this.backgroundRoot, -1);
    this.drawRect(lowerSnowfield, 0, -280, 840, 980, new Color(226, 239, 248, 255));

    const sideBanks = this.createGraphicsNode('SideBanks', this.backgroundRoot, -1);
    this.drawSideBanks(sideBanks);

    const trackNode = this.createGraphicsNode('Track', this.backgroundRoot, 0);
    const trackGraphics = this.ensureGraphics(trackNode);
    trackGraphics.clear();
    trackGraphics.fillColor = new Color(241, 247, 252, 255);
    trackGraphics.moveTo(-TRACK_HALF_WIDTH_FAR, TRACK_HORIZON_Y);
    trackGraphics.lineTo(TRACK_HALF_WIDTH_FAR, TRACK_HORIZON_Y);
    trackGraphics.lineTo(TRACK_HALF_WIDTH_NEAR, TRACK_NEAR_Y);
    trackGraphics.lineTo(-TRACK_HALF_WIDTH_NEAR, TRACK_NEAR_Y);
    trackGraphics.close();
    trackGraphics.fill();

    const trackShadow = this.createGraphicsNode('TrackShadow', this.backgroundRoot, 1);
    const shadowGraphics = this.ensureGraphics(trackShadow);
    shadowGraphics.clear();
    shadowGraphics.fillColor = new Color(180, 203, 228, 70);
    shadowGraphics.moveTo(-TRACK_HALF_WIDTH_FAR - 12, TRACK_HORIZON_Y + 12);
    shadowGraphics.lineTo(TRACK_HALF_WIDTH_FAR + 12, TRACK_HORIZON_Y + 12);
    shadowGraphics.lineTo(TRACK_HALF_WIDTH_NEAR + 28, TRACK_NEAR_Y - 8);
    shadowGraphics.lineTo(-TRACK_HALF_WIDTH_NEAR - 28, TRACK_NEAR_Y - 8);
    shadowGraphics.close();
    shadowGraphics.fill();

    const edgeGraphics = this.createGraphicsNode('TrackEdge', this.backgroundRoot, 1);
    const edge = this.ensureGraphics(edgeGraphics);
    edge.clear();
    edge.strokeColor = new Color(214, 231, 246, 255);
    edge.lineWidth = 6;
    edge.moveTo(-TRACK_HALF_WIDTH_FAR, TRACK_HORIZON_Y);
    edge.lineTo(-TRACK_HALF_WIDTH_NEAR, TRACK_NEAR_Y);
    edge.moveTo(TRACK_HALF_WIDTH_FAR, TRACK_HORIZON_Y);
    edge.lineTo(TRACK_HALF_WIDTH_NEAR, TRACK_NEAR_Y);
    edge.stroke();

    const grooveGraphics = this.createGraphicsNode('TrackGrooves', this.backgroundRoot, 2);
    this.drawTrackGrooves(grooveGraphics);

    for (let index = 0; index < 5; index += 1) {
      const stripeNode = this.createGraphicsNode(`Stripe-${index}`, this.backgroundRoot, 2);
      const graphic = this.ensureGraphics(stripeNode);
      graphic.clear();
      graphic.fillColor = new Color(255, 255, 255, 88);
      graphic.roundRect(-42, -18, 84, 36, 18);
      graphic.fill();
      this.stripes.push({
        node: stripeNode,
        depth: 0.08 + index * 0.18
      });
    }

    const leftGuide = this.createGraphicsNode('LaneGuideLeft', this.backgroundRoot, 3);
    const rightGuide = this.createGraphicsNode('LaneGuideRight', this.backgroundRoot, 3);
    this.drawLaneGuide(leftGuide, -1);
    this.drawLaneGuide(rightGuide, 1);
    this.laneGuideNodes.push(leftGuide, rightGuide);

    this.buildSideDecorations();
    this.buildAmbientSnow();

    this.skierNode = this.ensureChildNode(this.itemRoot, 'Skier', 4);
    this.renderSkierNode();
    const skierTransform = this.skierNode.getComponent(UITransform);
    if (skierTransform) {
      skierTransform.setContentSize(128, 168);
    }

    this.applyPreferenceVisuals();
  }

  private buildPanels(): void {
    if (!this.overlayRoot) {
      return;
    }

    this.hudPanelRoot = this.ensureChildNode(this.overlayRoot, 'HudPanelRoot', 2);
    this.homePanel = this.ensureChildNode(this.overlayRoot, 'HomePanel', 3);
    this.rankPanel = this.ensureChildNode(this.overlayRoot, 'RankPanel', 4);
    this.noticePanel = this.ensureChildNode(this.overlayRoot, 'NoticePanel', 5);
    this.settingsPanel = this.ensureChildNode(this.overlayRoot, 'SettingsPanel', 6);
    this.resultPanel = this.ensureChildNode(this.overlayRoot, 'ResultPanel', 7);

    this.hudPanelRoot.removeAllChildren();
    const homeBackground = this.ensureGraphics(this.homePanel);
    this.drawPanelBackground(homeBackground, 0, 26, 620, 860, new Color(11, 23, 39, 232));
    const rankBackground = this.ensureGraphics(this.rankPanel);
    this.drawPanelBackground(rankBackground, 0, 26, 620, 900, new Color(11, 23, 39, 236));
    const noticeBackground = this.ensureGraphics(this.noticePanel);
    this.drawPanelBackground(noticeBackground, 0, 26, 620, 900, new Color(11, 23, 39, 236));
    const settingsBackground = this.ensureGraphics(this.settingsPanel);
    this.drawPanelBackground(settingsBackground, 0, 26, 620, 900, new Color(11, 23, 39, 236));

    const resultBackground = this.ensureGraphics(this.resultPanel);
    this.drawPanelBackground(resultBackground, 0, -18, 620, 640, new Color(14, 22, 36, 234));

    this.homeTitleLabel = this.ensureLabelNode(this.homePanel, 'HomeTitle', 52);
    this.homeBadgeLabel = this.ensureLabelNode(this.homePanel, 'HomeBadge', 20);
    this.homeInfoLabel = this.ensureLabelNode(this.homePanel, 'HomeInfo', 28);
    this.homeToastLabel = this.ensureLabelNode(this.homePanel, 'HomeToast', 22);
    this.rankTitleLabel = this.ensureLabelNode(this.rankPanel, 'RankTitle', 44);
    this.rankInfoLabel = this.ensureLabelNode(this.rankPanel, 'RankInfo', 24);
    this.noticeTitleLabel = this.ensureLabelNode(this.noticePanel, 'NoticeTitle', 44);
    this.noticeInfoLabel = this.ensureLabelNode(this.noticePanel, 'NoticeInfo', 24);
    this.settingsTitleLabel = this.ensureLabelNode(this.settingsPanel, 'SettingsTitle', 44);
    this.settingsInfoLabel = this.ensureLabelNode(this.settingsPanel, 'SettingsInfo', 24);
    this.resultTitleLabel = this.ensureLabelNode(this.resultPanel, 'ResultTitle', 44);
    this.resultInfoLabel = this.ensureLabelNode(this.resultPanel, 'ResultInfo', 26);

    this.configureLabelNode(this.homeTitleLabel, new Vec3(0, 298, 0), HorizontalTextAlignment.CENTER, 520, 80, 56, 62);
    this.configureLabelNode(this.homeBadgeLabel, new Vec3(0, 244, 0), HorizontalTextAlignment.CENTER, 430, 46, 20, 24);
    this.configureLabelNode(this.homeInfoLabel, new Vec3(0, 8, 0), HorizontalTextAlignment.CENTER, 560, 110, 24, 32);
    this.configureLabelNode(this.homeToastLabel, new Vec3(0, -240, 0), HorizontalTextAlignment.CENTER, 560, 72, 22, 28);
    this.configureLabelNode(this.rankTitleLabel, new Vec3(0, 318, 0), HorizontalTextAlignment.CENTER, 540, 70, 44, 50);
    this.configureLabelNode(this.rankInfoLabel, new Vec3(0, 18, 0), HorizontalTextAlignment.LEFT, 540, 520, 24, 30);
    this.configureLabelNode(this.noticeTitleLabel, new Vec3(0, 318, 0), HorizontalTextAlignment.CENTER, 540, 70, 44, 50);
    this.configureLabelNode(this.noticeInfoLabel, new Vec3(0, 18, 0), HorizontalTextAlignment.LEFT, 540, 520, 24, 30);
    this.configureLabelNode(this.settingsTitleLabel, new Vec3(0, 318, 0), HorizontalTextAlignment.CENTER, 540, 70, 44, 50);
    this.configureLabelNode(this.settingsInfoLabel, new Vec3(0, 162, 0), HorizontalTextAlignment.LEFT, 540, 180, 24, 30);
    this.configureLabelNode(this.resultTitleLabel, new Vec3(0, 196, 0), HorizontalTextAlignment.CENTER, 520, 70, 46, 52);
    this.configureLabelNode(this.resultInfoLabel, new Vec3(0, 40, 0), HorizontalTextAlignment.CENTER, 560, 150, 24, 30);

    this.homeButtons = [
      this.createButton(this.homePanel, 'StartButton', 'Start Run', new Vec3(0, -348, 0), 'start_run', { width: 320, height: 66 }, {
        activeColor: new Color(20, 152, 108, 255),
        disabledColor: new Color(77, 92, 92, 255)
      }),
      this.createButton(this.homePanel, 'RankButton', 'Leaderboard', new Vec3(0, -426, 0), 'view_rank', { width: 320, height: 56 }, {
        activeColor: new Color(43, 87, 162, 255),
        disabledColor: new Color(77, 84, 97, 255)
      }),
      this.createButton(this.homePanel, 'NoticeButton', 'Notice', new Vec3(0, -494, 0), 'view_notice', { width: 320, height: 56 }, {
        activeColor: new Color(54, 99, 173, 255),
        disabledColor: new Color(77, 84, 97, 255)
      }),
      this.createButton(this.homePanel, 'SettingsButton', 'Settings', new Vec3(0, -562, 0), 'view_settings', { width: 320, height: 56 }, {
        activeColor: new Color(83, 96, 122, 255),
        disabledColor: new Color(77, 84, 97, 255)
      })
    ];

    this.rankButtons = [
      this.createButton(this.rankPanel, 'RankBackButton', 'Back Home', new Vec3(0, -366, 0), 'close_rank', { width: 260, height: 58 }, {
        activeColor: new Color(87, 95, 120, 255),
        disabledColor: new Color(77, 84, 97, 255)
      })
    ];

    this.noticeButtons = [
      this.createButton(this.noticePanel, 'NoticeBackButton', 'Back Home', new Vec3(0, -366, 0), 'close_notice', { width: 260, height: 58 }, {
        activeColor: new Color(87, 95, 120, 255),
        disabledColor: new Color(77, 84, 97, 255)
      })
    ];

    this.settingsButtons = [
      this.createButton(this.settingsPanel, 'AudioButton', 'Audio: On', new Vec3(0, 84, 0), 'toggle_audio', { width: 320, height: 58 }, {
        activeColor: new Color(84, 93, 210, 255),
        disabledColor: new Color(77, 84, 97, 255)
      }),
      this.createButton(this.settingsPanel, 'SnowFxButton', 'Snow FX: On', new Vec3(0, 8, 0), 'toggle_snow_fx', { width: 320, height: 58 }, {
        activeColor: new Color(52, 116, 215, 255),
        disabledColor: new Color(77, 84, 97, 255)
      }),
      this.createButton(this.settingsPanel, 'AssistButton', 'Assist Lines: On', new Vec3(0, -68, 0), 'toggle_assist', { width: 320, height: 58 }, {
        activeColor: new Color(36, 152, 126, 255),
        disabledColor: new Color(77, 84, 97, 255)
      }),
      this.createButton(this.settingsPanel, 'CoachButton', 'Coach Tips: On', new Vec3(0, -144, 0), 'toggle_coach', { width: 320, height: 58 }, {
        activeColor: new Color(221, 162, 37, 255),
        disabledColor: new Color(77, 84, 97, 255)
      }),
      this.createButton(this.settingsPanel, 'SettingsBackButton', 'Back Home', new Vec3(0, -278, 0), 'close_settings', { width: 260, height: 58 }, {
        activeColor: new Color(87, 95, 120, 255),
        disabledColor: new Color(77, 84, 97, 255)
      })
    ];

    this.resultButtons = [
      this.createButton(this.resultPanel, 'ReviveButton', 'Revive', new Vec3(0, -112, 0), 'revive', { width: 320, height: 58 }, {
        activeColor: new Color(245, 154, 33, 255),
        disabledColor: new Color(97, 89, 72, 255)
      }),
      this.createButton(this.resultPanel, 'DoubleButton', 'Double Coins', new Vec3(0, -184, 0), 'double_coin', { width: 320, height: 58 }, {
        activeColor: new Color(47, 113, 224, 255),
        disabledColor: new Color(77, 84, 97, 255)
      }),
      this.createButton(this.resultPanel, 'RestartButton', 'Restart', new Vec3(0, -256, 0), 'restart', { width: 320, height: 58 }, {
        activeColor: new Color(31, 163, 134, 255),
        disabledColor: new Color(77, 84, 97, 255)
      }),
      this.createButton(this.resultPanel, 'HomeButton', 'Back Home', new Vec3(0, -328, 0), 'back_home', { width: 320, height: 58 }, {
        activeColor: new Color(87, 95, 120, 255),
        disabledColor: new Color(77, 84, 97, 255)
      })
    ];

    this.hudCards = [
      this.createStatCard(this.hudPanelRoot, 'DistanceCard', 'Distance', new Vec3(-160, 568, 0), new Color(52, 116, 215, 230), { width: 146, height: 74 }, 'distance'),
      this.createStatCard(this.hudPanelRoot, 'CoinCard', 'Coins', new Vec3(0, 568, 0), new Color(221, 162, 37, 230), { width: 146, height: 74 }, 'coins'),
      this.createStatCard(this.hudPanelRoot, 'SpeedCard', 'Speed', new Vec3(160, 568, 0), new Color(36, 152, 126, 230), { width: 146, height: 74 }, 'speed')
    ];

    this.homeCards = [
      this.createStatCard(this.homePanel, 'HomeBestDistanceCard', 'Best Distance', new Vec3(0, 140, 0), new Color(52, 116, 215, 230), { width: 220, height: 88 }),
      this.createStatCard(this.homePanel, 'HomeCoinBankCard', 'Coin Bank', new Vec3(0, 40, 0), new Color(221, 162, 37, 230), { width: 220, height: 88 }),
      this.createStatCard(this.homePanel, 'HomeBestScoreCard', 'Best Score', new Vec3(0, -60, 0), new Color(36, 152, 126, 230), { width: 220, height: 88 })
    ];

    this.resultCards = [
      this.createStatCard(this.resultPanel, 'ResultDistanceCard', 'Distance', new Vec3(0, 112, 0), new Color(52, 116, 215, 230), { width: 220, height: 88 }),
      this.createStatCard(this.resultPanel, 'ResultCoinCard', 'Run Coins', new Vec3(0, 8, 0), new Color(221, 162, 37, 230), { width: 220, height: 88 }),
      this.createStatCard(this.resultPanel, 'ResultBestCard', 'Best', new Vec3(0, -96, 0), new Color(36, 152, 126, 230), { width: 220, height: 88 })
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
    this.settingsPanel && (this.settingsPanel.active = false);
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
        this.preferences.coachTipsEnabled
          ? 'Clean lane reads matter more than raw speed.'
          : 'Pick the lane early and commit.'
      ].join('\n');
    }

    if (this.homeToastLabel) {
      this.homeToastLabel.string = this.preferences.coachTipsEnabled
        ? 'Start a run, check the live board, review current mountain updates, or tune local slope settings.'
        : 'Start a run, review the board, or adjust local slope settings.';
    }

    this.hudLabel && (this.hudLabel.string = '');
    this.hudPanelRoot && (this.hudPanelRoot.active = false);
    this.hintLabel &&
      (this.hintLabel.string = [
        'Tap Start to hit the slope',
        '',
        'Touch left / right while playing',
        this.preferences.coachTipsEnabled
          ? 'to switch lanes around obstacles.'
          : 'to snap between lanes fast.'
      ].join('\n'));
    this.resultLabel && (this.resultLabel.string = '');
    this.audioDirector.setBgmMode('home');
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
    this.settingsPanel && (this.settingsPanel.active = false);
    this.resultPanel && (this.resultPanel.active = false);
    this.hudPanelRoot && (this.hudPanelRoot.active = true);
    this.resultLabel && (this.resultLabel.string = 'Warm-up\nWide lanes and easy lines.');
    this.renderHint();
    this.updateSkierVisual(0);
    this.renderHud();
    this.audioDirector.playRestart();
    this.audioDirector.setBgmMode('run');
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
    this.settingsPanel && (this.settingsPanel.active = false);
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
    this.audioDirector.playButton();

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
    this.settingsPanel && (this.settingsPanel.active = false);
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
    this.audioDirector.playButton();

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

  private showSettingsScreen(): void {
    this.phase = 'settings';
    this.clearEntities();
    this.runState = null;
    this.homePanel && (this.homePanel.active = false);
    this.rankPanel && (this.rankPanel.active = false);
    this.noticePanel && (this.noticePanel.active = false);
    this.resultPanel && (this.resultPanel.active = false);
    this.settingsPanel && (this.settingsPanel.active = true);
    this.hudPanelRoot && (this.hudPanelRoot.active = false);
    this.skierNode && (this.skierNode.active = false);

    if (this.settingsTitleLabel) {
      this.settingsTitleLabel.string = 'SLOPE SETTINGS';
    }

    this.renderSettingsInfo();
    this.resultLabel && (this.resultLabel.string = '');
    this.renderHint();
    this.audioDirector.playButton();
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
      this.spawnEntity('obstacle', lane, 0.02 + index * 0.018, obstacleType);
    }

    const safeLanes = lanes.filter((lane) => !lanes.slice(0, obstacleCount).includes(lane));
    const primaryCoinLane = safeLanes[0];
    if (primaryCoinLane !== undefined && Math.random() < profile.coinChance) {
      this.spawnEntity('coin', primaryCoinLane, 0.09);
    }

    const bonusCoinLane = safeLanes[1];
    if (bonusCoinLane !== undefined && Math.random() < profile.bonusCoinChance) {
      this.spawnEntity('coin', bonusCoinLane, 0.15);
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

  private spawnEntity(kind: EntityKind, laneIndex: LaneIndex, depth: number, obstacleType: ObstacleType = 'tree'): void {
    if (!this.itemRoot) {
      return;
    }

    const node = this.createVisualNode(`${kind}-${Date.now()}`, this.itemRoot, 1);

    if (kind === 'coin') {
      this.renderCoinNode(node);
    } else {
      this.renderObstacleNode(node, obstacleType, 'track');
    }

    const transform = node.getComponent(UITransform);
    if (transform) {
      if (kind === 'coin') {
        transform.setContentSize(58, 58);
      } else if (obstacleType === 'rock') {
        transform.setContentSize(136, 104);
      } else if (obstacleType === 'gate') {
        transform.setContentSize(160, 144);
      } else {
        transform.setContentSize(150, 176);
      }
    }

    this.entities.push({
      kind,
      obstacleType: kind === 'obstacle' ? obstacleType : undefined,
      laneIndex,
      depth,
      node,
      colliderRadius: kind === 'coin' ? 38 : obstacleType === 'gate' ? 60 : 72,
      pulseOffset: Math.random() * Math.PI * 2
    });
    this.positionEntity(this.entities[this.entities.length - 1]);
  }

  private updateEntities(deltaTime: number, speed: number): void {
    const moveDelta = speed * deltaTime * ENTITY_DEPTH_FACTOR;
    const survivors: TrackEntity[] = [];

    for (const entity of this.entities) {
      entity.depth += moveDelta;

      if (entity.depth > 1.08) {
        entity.node.destroy();
        continue;
      }

      this.positionEntity(entity);

      if (this.runState && this.phase === 'running' && !this.runState.finished) {
        const isSameLane = entity.laneIndex === this.runState.laneIndex;
        const entityY = this.projectDepthToY(entity.depth);
        const isNearPlayer =
          Math.abs(entity.depth - PLAYER_COLLISION_DEPTH) < (entity.kind === 'coin' ? 0.05 : 0.06) ||
          Math.abs(entityY - PLAYER_Y) < (entity.kind === 'coin' ? 34 : 52);

        if (isSameLane && isNearPlayer) {
          if (entity.kind === 'coin') {
            this.runState.coinsCollected += 1;
            entity.node.destroy();
            this.resultLabel && (this.resultLabel.string = `Coin collected\nrunCoins=${String(this.runState.coinsCollected)}`);
            this.audioDirector.playCoin();
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

      this.audioDirector.playCrash();
      this.audioDirector.setBgmMode('result');
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
        if (Math.abs(this.projectDepthToY(entity.depth) - PLAYER_Y) < 140) {
          entity.node.destroy();
        }
      });
      this.entities = this.entities.filter(
        (entity) => Math.abs(this.projectDepthToY(entity.depth) - PLAYER_Y) >= 140
      );
      this.resultPanel && (this.resultPanel.active = false);
      this.resultLabel && (this.resultLabel.string = `Revived\nverification=${verification.verificationId}`);
      this.hudPanelRoot && (this.hudPanelRoot.active = true);
      this.skierNode && (this.skierNode.active = true);
      this.audioDirector.playRevive();
      this.audioDirector.setBgmMode('run');
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
      this.audioDirector.playReward();
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

    const stripeDelta = this.runState.speed * deltaTime * STRIPE_DEPTH_FACTOR;

    for (const stripe of this.stripes) {
      stripe.depth += stripeDelta;
      if (stripe.depth > 1.02) {
        stripe.depth -= 0.92;
      }

      const progress = this.getDepthCurve(stripe.depth);
      const halfWidth = this.interpolate(TRACK_HALF_WIDTH_FAR - 12, TRACK_HALF_WIDTH_NEAR - 54, progress);
      const y = this.projectDepthToY(stripe.depth);
      stripe.node.setPosition(0, y, 0);
      stripe.node.setScale(halfWidth / 120, 0.72 + progress * 2.1, 1);
      stripe.node.angle = Math.sin(this.animationClock * 0.9 + stripe.depth * 6) * 0.8;
    }

    const roadsideDelta = this.runState.speed * deltaTime * ROADSIDE_DEPTH_FACTOR;
    for (const decoration of this.roadsideDecorations) {
      decoration.depth += roadsideDelta;
      if (decoration.depth > 1.08) {
        decoration.depth = 0.04 + Math.random() * 0.1;
        decoration.obstacleType = Math.random() < 0.78 ? 'tree' : 'rock';
        decoration.lateralOffset = 56 + Math.random() * 68;
        decoration.pulseOffset = Math.random() * Math.PI * 2;
        this.renderObstacleNode(decoration.node, decoration.obstacleType, 'decor');
      }

      this.positionRoadsideDecoration(decoration);
    }

    for (const particle of this.snowParticles) {
      particle.y -= (particle.speed + this.runState.speed * 3.8) * deltaTime;
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
        this.preferences.coachTipsEnabled
          ? 'Keep a clean line, then take coins on safe reads.'
          : 'Hold your line and commit to the gap.'
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

    if (this.phase === 'settings') {
      this.hintLabel.string = [
        'Audio controls all local music and SFX.',
        'Snow FX controls ambient particles.',
        'Assist Lines show lane guides on the slope.',
        '',
        'Coach Tips changes tutorial-style copy.'
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
      this.preferences.coachTipsEnabled
        ? 'Read the safe lane first, then take coins on clean lines.'
        : 'Pick the gap first, then chase the coin line.'
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

  private renderSettingsInfo(): void {
    if (!this.settingsInfoLabel) {
      return;
    }

    this.settingsInfoLabel.string = [
      'Local slope presentation',
      '',
      `Audio          ${this.preferences.audioEnabled ? 'Enabled' : 'Disabled'}`,
      `Snow FX        ${this.preferences.snowFxEnabled ? 'Enabled' : 'Disabled'}`,
      `Assist Lines   ${this.preferences.assistLinesEnabled ? 'Enabled' : 'Disabled'}`,
      `Coach Tips     ${this.preferences.coachTipsEnabled ? 'Enabled' : 'Disabled'}`,
      '',
      'These toggles only affect your local play session.'
    ].join('\n');

    this.updateSettingsButtonLabels();
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
    this.configureLabelNode(this.hudLabel, new Vec3(-280, 458, 0), HorizontalTextAlignment.LEFT, 220, 140, 18, 22);
    this.configureLabelNode(this.hintLabel, new Vec3(0, -548, 0), HorizontalTextAlignment.CENTER, 560, 130, 20, 26);
    this.configureLabelNode(this.resultLabel, new Vec3(0, -474, 0), HorizontalTextAlignment.CENTER, 500, 90, 20, 24);

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
    const bob = this.phase === 'running' ? Math.sin(this.animationClock * 8.2) * 4 : 0;
    const squash = this.phase === 'running' ? 1 + Math.sin(this.animationClock * 8.2) * 0.02 : 1;
    this.skierNode.setPosition(this.getLaneX(laneIndex, 0.98), PLAYER_Y + bob, 0);
    this.skierNode.setScale(squash, squash, 1);
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
        this.audioDirector.playButton();
        this.startNewRun();
        break;
      case 'view_rank':
        this.audioDirector.playButton();
        void this.showRankScreen();
        break;
      case 'view_notice':
        this.audioDirector.playButton();
        void this.showNoticeScreen();
        break;
      case 'view_settings':
        this.audioDirector.playButton();
        this.showSettingsScreen();
        break;
      case 'revive':
        this.audioDirector.playButton();
        void this.reviveRun();
        break;
      case 'double_coin':
        this.audioDirector.playButton();
        void this.claimDoubleCoins();
        break;
      case 'restart':
        this.audioDirector.playButton();
        this.startNewRun();
        break;
      case 'back_home':
        this.audioDirector.playButton();
        this.showHomeScreen();
        break;
      case 'close_rank':
        this.audioDirector.playButton();
        this.showHomeScreen();
        break;
      case 'close_notice':
        this.audioDirector.playButton();
        this.showHomeScreen();
        break;
      case 'close_settings':
        this.audioDirector.playButton();
        this.showHomeScreen();
        break;
      case 'toggle_audio':
        this.preferences.audioEnabled = !this.preferences.audioEnabled;
        this.persistPreferences();
        this.audioDirector.setAudioEnabled(this.preferences.audioEnabled);
        if (this.preferences.audioEnabled) {
          this.audioDirector.playButton();
          this.audioDirector.setBgmMode(this.phase === 'running' ? 'run' : this.phase === 'result' ? 'result' : 'home');
        }
        this.renderSettingsInfo();
        break;
      case 'toggle_snow_fx':
        this.preferences.snowFxEnabled = !this.preferences.snowFxEnabled;
        this.persistPreferences();
        this.applyPreferenceVisuals();
        this.audioDirector.playButton();
        this.renderSettingsInfo();
        break;
      case 'toggle_assist':
        this.preferences.assistLinesEnabled = !this.preferences.assistLinesEnabled;
        this.persistPreferences();
        this.applyPreferenceVisuals();
        this.audioDirector.playButton();
        this.renderSettingsInfo();
        break;
      case 'toggle_coach':
        this.preferences.coachTipsEnabled = !this.preferences.coachTipsEnabled;
        this.persistPreferences();
        this.audioDirector.playButton();
        this.renderSettingsInfo();
        this.renderHint();
        break;
      default:
        break;
    }
  }

  private updateSettingsButtonLabels(): void {
    const setText = (id: ButtonActionId, text: string): void => {
      const button = this.settingsButtons.find((item) => item.id === id);
      if (!button) {
        return;
      }
      button.label.string = text;
    };

    setText('toggle_audio', `Audio: ${this.preferences.audioEnabled ? 'On' : 'Off'}`);
    setText('toggle_snow_fx', `Snow FX: ${this.preferences.snowFxEnabled ? 'On' : 'Off'}`);
    setText('toggle_assist', `Assist Lines: ${this.preferences.assistLinesEnabled ? 'On' : 'Off'}`);
    setText('toggle_coach', `Coach Tips: ${this.preferences.coachTipsEnabled ? 'On' : 'Off'}`);
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
    const progress = this.getDepthCurve(entity.depth);
    const laneSpread = this.interpolate(LANE_SPREAD_FAR, LANE_SPREAD_NEAR, progress);
    const x = this.getLaneX(entity.laneIndex, laneSpread);
    const y = this.projectDepthToY(entity.depth);
    const scale = this.interpolate(0.28, 1.32, progress);
    const pulse = Math.sin(this.animationClock * 7.2 + entity.pulseOffset);
    const bob = entity.kind === 'coin' ? pulse * (4 + progress * 6) : 0;
    const visualScale = entity.kind === 'coin' ? scale * (1 + pulse * 0.08) : scale;

    entity.node.setPosition(x, y + bob, 0);
    entity.node.setScale(visualScale, visualScale, 1);
    entity.node.angle =
      entity.kind === 'obstacle' && entity.obstacleType === 'tree'
        ? pulse * 1.8
        : entity.kind === 'obstacle' && entity.obstacleType === 'gate'
          ? pulse * 0.8
          : 0;
  }

  private getLaneX(laneIndex: LaneIndex, spread: number): number {
    return laneIndex * spread;
  }

  private getDepthCurve(depth: number): number {
    const clamped = Math.max(0, Math.min(1, depth));
    return Math.pow(clamped, 1.65);
  }

  private projectDepthToY(depth: number): number {
    return this.interpolate(TRACK_HORIZON_Y, TRACK_NEAR_Y, this.getDepthCurve(depth));
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

  private createVisualNode(name: string, parent: Node, siblingIndex: number): Node {
    const node = new Node(name);
    parent.addChild(node);
    if (siblingIndex >= 0) {
      node.setSiblingIndex(siblingIndex);
    }
    node.addComponent(UITransform);
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

  private ensureSprite(node: Node): Sprite {
    let transform = node.getComponent(UITransform);
    if (!transform) {
      transform = node.addComponent(UITransform);
    }

    let sprite = node.getComponent(Sprite);
    if (!sprite) {
      sprite = node.addComponent(Sprite);
    }

    sprite.sizeMode = Sprite.SizeMode.CUSTOM;
    return sprite;
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

  private drawSideBanks(node: Node): void {
    const graphics = this.ensureGraphics(node);
    graphics.clear();
    graphics.fillColor = new Color(236, 245, 251, 255);
    graphics.moveTo(-420, TRACK_HORIZON_Y + 42);
    graphics.lineTo(-TRACK_HALF_WIDTH_FAR - 18, TRACK_HORIZON_Y + 8);
    graphics.lineTo(-TRACK_HALF_WIDTH_NEAR - 18, TRACK_NEAR_Y - 6);
    graphics.lineTo(-420, TRACK_NEAR_Y - 6);
    graphics.close();
    graphics.fill();

    graphics.moveTo(420, TRACK_HORIZON_Y + 42);
    graphics.lineTo(TRACK_HALF_WIDTH_FAR + 18, TRACK_HORIZON_Y + 8);
    graphics.lineTo(TRACK_HALF_WIDTH_NEAR + 18, TRACK_NEAR_Y - 6);
    graphics.lineTo(420, TRACK_NEAR_Y - 6);
    graphics.close();
    graphics.fill();
  }

  private drawTrackGrooves(node: Node): void {
    const graphics = this.ensureGraphics(node);
    graphics.clear();
    graphics.strokeColor = new Color(189, 216, 238, 212);
    graphics.lineWidth = 4;
    graphics.moveTo(-14, TRACK_HORIZON_Y);
    graphics.lineTo(-54, TRACK_NEAR_Y);
    graphics.moveTo(14, TRACK_HORIZON_Y);
    graphics.lineTo(54, TRACK_NEAR_Y);
    graphics.stroke();

    graphics.strokeColor = new Color(255, 255, 255, 116);
    graphics.lineWidth = 2;
    graphics.moveTo(-44, TRACK_HORIZON_Y + 8);
    graphics.lineTo(-124, TRACK_NEAR_Y);
    graphics.moveTo(44, TRACK_HORIZON_Y + 8);
    graphics.lineTo(124, TRACK_NEAR_Y);
    graphics.stroke();
  }

  private drawLaneGuide(node: Node, direction: -1 | 1): void {
    const graphics = this.ensureGraphics(node);
    graphics.clear();
    graphics.strokeColor = new Color(255, 255, 255, 55);
    graphics.lineWidth = 4;
    graphics.moveTo(direction * 18, TRACK_HORIZON_Y);
    graphics.lineTo(direction * 118, TRACK_NEAR_Y);
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

    for (let index = 0; index < 10; index += 1) {
      const leftTree = this.createVisualNode(`DecorTreeLeft-${index}`, this.backgroundRoot, 4);
      const rightTree = this.createVisualNode(`DecorTreeRight-${index}`, this.backgroundRoot, 4);
      this.roadsideDecorations.push({
        node: leftTree,
        side: -1,
        obstacleType: Math.random() < 0.82 ? 'tree' : 'rock',
        depth: (index / 10) * 0.98,
        lateralOffset: 54 + Math.random() * 62,
        pulseOffset: Math.random() * Math.PI * 2
      });
      this.roadsideDecorations.push({
        node: rightTree,
        side: 1,
        obstacleType: Math.random() < 0.82 ? 'tree' : 'rock',
        depth: ((index + 0.45) / 10) * 0.98,
        lateralOffset: 54 + Math.random() * 62,
        pulseOffset: Math.random() * Math.PI * 2
      });
    }

    for (const decoration of this.roadsideDecorations) {
      this.renderObstacleNode(decoration.node, decoration.obstacleType, 'decor');
      this.positionRoadsideDecoration(decoration);
    }

    const snowDriftLeft = this.createGraphicsNode('SnowDriftLeft', this.backgroundRoot, 5);
    const snowDriftRight = this.createGraphicsNode('SnowDriftRight', this.backgroundRoot, 5);
    this.drawSnowDrift(snowDriftLeft, -360);
    this.drawSnowDrift(snowDriftRight, 360);
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
        x: -330 + Math.random() * 660,
        y: -620 + Math.random() * 1240,
        speed: 26 + Math.random() * 38
      });
    }
  }

  private applyPreferenceVisuals(): void {
    for (const particle of this.snowParticles) {
      particle.node.active = this.preferences.snowFxEnabled;
    }

    for (const laneGuide of this.laneGuideNodes) {
      laneGuide.active = this.preferences.assistLinesEnabled;
    }
  }

  private loadPreferences(): void {
    try {
      if (typeof localStorage === 'undefined') {
        return;
      }

      const raw = localStorage.getItem(PREFERENCES_STORAGE_KEY);
      if (!raw) {
        return;
      }

      const parsed = JSON.parse(raw) as Partial<SkiLocalPreferences>;
      this.preferences = {
        audioEnabled: parsed.audioEnabled ?? true,
        snowFxEnabled: parsed.snowFxEnabled ?? true,
        assistLinesEnabled: parsed.assistLinesEnabled ?? true,
        coachTipsEnabled: parsed.coachTipsEnabled ?? true
      };
    } catch {
      this.preferences = {
        audioEnabled: true,
        snowFxEnabled: true,
        assistLinesEnabled: true,
        coachTipsEnabled: true
      };
    }
  }

  private persistPreferences(): void {
    try {
      if (typeof localStorage === 'undefined') {
        return;
      }

      localStorage.setItem(PREFERENCES_STORAGE_KEY, JSON.stringify(this.preferences));
    } catch {
      // Ignore local persistence failures in preview environments.
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

  private positionRoadsideDecoration(decoration: RoadsideDecoration): void {
    const progress = this.getDepthCurve(decoration.depth);
    const trackEdgeX = this.interpolate(TRACK_HALF_WIDTH_FAR + 26, TRACK_HALF_WIDTH_NEAR + 34, progress);
    const x = decoration.side * (trackEdgeX + decoration.lateralOffset * (0.55 + progress * 0.75));
    const y = this.projectDepthToY(decoration.depth) + this.interpolate(24, -10, progress);
    const scaleBase =
      decoration.obstacleType === 'rock'
        ? this.interpolate(0.34, 1.22, progress)
        : this.interpolate(0.42, 1.46, progress);
    const sway = Math.sin(this.animationClock * 3.4 + decoration.pulseOffset) * 1.2;

    decoration.node.setPosition(x, y, 0);
    decoration.node.setScale(scaleBase, scaleBase, 1);
    decoration.node.angle = decoration.obstacleType === 'tree' ? sway : 0;
  }

  private async loadVisualAssets(): Promise<void> {
    if (this.visualsRequested) {
      return;
    }

    this.visualsRequested = true;

    const [
      background,
      player,
      coin,
      tree,
      rock,
      gate
    ] = await Promise.all([
      this.loadSpriteFrame('ski/backgrounds/background-snowfield'),
      this.loadSpriteFrame('ski/sprites/player-skier-back'),
      this.loadSpriteFrame('ski/sprites/coin-gold'),
      this.loadSpriteFrame('ski/sprites/tree-snow-pine'),
      this.loadSpriteFrame('ski/sprites/rock-snow'),
      this.loadSpriteFrame('ski/sprites/gate-red')
    ]);

    this.visualFrames.background = background;
    this.visualFrames.player = player;
    this.visualFrames.coin = coin;
    this.visualFrames.tree = tree;
    this.visualFrames.rock = rock;
    this.visualFrames.gate = gate;

    this.buildTrackVisuals();
    this.applyDefaultLayout();
    this.updateSkierVisual(this.runState?.laneIndex ?? 0);
    this.renderHud();
    this.renderHint();
  }

  private loadSpriteFrame(path: string): Promise<SpriteFrame | null> {
    return new Promise((resolve) => {
      resources.load(`${path}/spriteFrame`, SpriteFrame, (error, frame) => {
        if (error) {
          resolve(null);
          return;
        }
        resolve(frame);
      });
    });
  }

  private createBackgroundSprite(parent: Node, frame: SpriteFrame): void {
    const node = this.createVisualNode('BackdropSprite', parent, -5);
    const sprite = this.ensureSprite(node);
    const transform = node.getComponent(UITransform);
    const baseWidth = frame.originalSize.width || frame.rect.width;
    const baseHeight = frame.originalSize.height || frame.rect.height;
    const coverScale = Math.max(760 / baseWidth, 1320 / baseHeight);

    sprite.spriteFrame = frame;
    if (transform) {
      transform.setContentSize(baseWidth, baseHeight);
    }
    node.setScale(coverScale, coverScale, 1);
    node.setPosition(0, 0, 0);
  }

  private renderSkierNode(): void {
    if (!this.skierNode) {
      return;
    }

    if (this.visualFrames.player) {
      this.applySpriteVisual(this.skierNode, this.visualFrames.player, 132, 182);
      return;
    }

    const skierGraphic = this.beginFallbackGraphics(this.skierNode, 120, 120);
    this.drawSkier(skierGraphic);
  }

  private renderCoinNode(node: Node): void {
    if (this.visualFrames.coin) {
      this.applySpriteVisual(node, this.visualFrames.coin, 56, 56);
      return;
    }

    const graphic = this.beginFallbackGraphics(node, 48, 48);
    this.drawCoin(graphic);
  }

  private renderObstacleNode(node: Node, obstacleType: ObstacleType, usage: 'track' | 'decor'): void {
    const frame =
      obstacleType === 'tree'
        ? this.visualFrames.tree
        : obstacleType === 'rock'
          ? this.visualFrames.rock
          : this.visualFrames.gate;

    const size =
      obstacleType === 'rock'
        ? usage === 'decor'
          ? { width: 132, height: 104 }
          : { width: 136, height: 104 }
        : obstacleType === 'gate'
          ? usage === 'decor'
            ? { width: 142, height: 150 }
            : { width: 160, height: 144 }
          : usage === 'decor'
            ? { width: 164, height: 194 }
            : { width: 150, height: 176 };

    if (frame) {
      this.applySpriteVisual(node, frame, size.width, size.height);
      return;
    }

    const graphic = this.beginFallbackGraphics(node, size.width, size.height);
    this.drawObstacle(graphic, obstacleType);
  }

  private beginFallbackGraphics(node: Node, width: number, height: number): Graphics {
    const sprite = node.getComponent(Sprite);
    if (sprite) {
      sprite.enabled = false;
    }

    const transform = node.getComponent(UITransform);
    if (transform) {
      transform.setContentSize(width, height);
    }

    const graphics = this.ensureGraphics(node);
    graphics.enabled = true;
    graphics.clear();
    return graphics;
  }

  private applySpriteVisual(node: Node, frame: SpriteFrame, width: number, height: number): void {
    const graphics = node.getComponent(Graphics);
    if (graphics) {
      graphics.enabled = false;
      graphics.clear();
    }

    const sprite = this.ensureSprite(node);
    sprite.enabled = true;
    sprite.spriteFrame = frame;

    const transform = node.getComponent(UITransform);
    if (transform) {
      transform.setContentSize(width, height);
    }
  }

  private drawSkier(graphics: Graphics): void {
    graphics.clear();
    graphics.fillColor = new Color(26, 32, 45, 80);
    graphics.ellipse(0, -28, 56, 15);
    graphics.fill();

    graphics.fillColor = new Color(33, 41, 57, 255);
    graphics.roundRect(-52, -18, 104, 10, 6);
    graphics.fill();

    graphics.fillColor = new Color(214, 224, 236, 255);
    graphics.roundRect(-48, -14, 96, 8, 4);
    graphics.fill();

    graphics.fillColor = new Color(217, 68, 78, 255);
    graphics.moveTo(0, 42);
    graphics.lineTo(-26, 0);
    graphics.lineTo(26, 0);
    graphics.close();
    graphics.fill();

    graphics.fillColor = new Color(39, 47, 65, 255);
    graphics.rect(-17, -10, 12, 20);
    graphics.rect(5, -10, 12, 20);
    graphics.fill();

    graphics.fillColor = new Color(248, 252, 255, 255);
    graphics.circle(0, 20, 11);
    graphics.fill();

    graphics.fillColor = new Color(38, 59, 88, 255);
    graphics.circle(0, 23, 8);
    graphics.fill();

    graphics.fillColor = new Color(250, 191, 53, 255);
    graphics.roundRect(-16, 10, 32, 6, 3);
    graphics.fill();
  }

  private drawCoin(graphics: Graphics): void {
    graphics.clear();
    graphics.fillColor = new Color(32, 39, 52, 70);
    graphics.ellipse(0, -18, 24, 8);
    graphics.fill();

    graphics.fillColor = new Color(246, 196, 44, 255);
    graphics.circle(0, 0, 22);
    graphics.fill();

    graphics.fillColor = new Color(255, 221, 96, 255);
    graphics.circle(0, 0, 16);
    graphics.fill();

    graphics.strokeColor = new Color(255, 246, 196, 255);
    graphics.lineWidth = 4;
    graphics.circle(0, 0, 12);
    graphics.stroke();

    graphics.strokeColor = new Color(255, 255, 255, 160);
    graphics.lineWidth = 3;
    graphics.moveTo(-6, 11);
    graphics.lineTo(7, -2);
    graphics.stroke();
  }

  private drawObstacle(graphics: Graphics, obstacleType: ObstacleType): void {
    graphics.clear();

    if (obstacleType === 'tree') {
      graphics.fillColor = new Color(29, 34, 43, 72);
      graphics.ellipse(0, -44, 34, 12);
      graphics.fill();

      graphics.fillColor = new Color(83, 59, 38, 255);
      graphics.roundRect(-8, -42, 16, 32, 6);
      graphics.fill();

      graphics.fillColor = new Color(25, 120, 72, 255);
      graphics.moveTo(0, 44);
      graphics.lineTo(-30, 6);
      graphics.lineTo(30, 6);
      graphics.close();
      graphics.fill();

      graphics.fillColor = new Color(31, 143, 82, 255);
      graphics.moveTo(0, 26);
      graphics.lineTo(-40, -12);
      graphics.lineTo(40, -12);
      graphics.close();
      graphics.fill();

      graphics.fillColor = new Color(47, 165, 101, 255);
      graphics.moveTo(0, 10);
      graphics.lineTo(-50, -30);
      graphics.lineTo(50, -30);
      graphics.close();
      graphics.fill();

      graphics.fillColor = new Color(240, 248, 255, 235);
      graphics.moveTo(0, 38);
      graphics.lineTo(-16, 18);
      graphics.lineTo(16, 18);
      graphics.close();
      graphics.fill();
      return;
    }

    if (obstacleType === 'gate') {
      graphics.fillColor = new Color(29, 34, 43, 66);
      graphics.ellipse(0, -48, 52, 12);
      graphics.fill();

      graphics.fillColor = new Color(212, 62, 62, 255);
      graphics.roundRect(-34, -44, 10, 92, 4);
      graphics.roundRect(24, -44, 10, 92, 4);
      graphics.fill();

      graphics.fillColor = new Color(255, 247, 247, 255);
      graphics.roundRect(-24, 10, 48, 10, 3);
      graphics.fill();

      graphics.fillColor = new Color(224, 78, 78, 255);
      graphics.moveTo(-24, 22);
      graphics.lineTo(-58, 10);
      graphics.lineTo(-24, -4);
      graphics.close();
      graphics.fill();

      graphics.moveTo(24, 22);
      graphics.lineTo(58, 10);
      graphics.lineTo(24, -4);
      graphics.close();
      graphics.fill();
      return;
    }

    graphics.fillColor = new Color(29, 34, 43, 66);
    graphics.ellipse(0, -48, 44, 12);
    graphics.fill();

    graphics.fillColor = new Color(106, 114, 129, 255);
    graphics.moveTo(0, 44);
    graphics.lineTo(-46, 12);
    graphics.lineTo(-34, -34);
    graphics.lineTo(28, -40);
    graphics.lineTo(50, 2);
    graphics.close();
    graphics.fill();

    graphics.fillColor = new Color(154, 164, 181, 255);
    graphics.moveTo(-8, 26);
    graphics.lineTo(-24, -2);
    graphics.lineTo(10, -12);
    graphics.lineTo(22, 10);
    graphics.close();
    graphics.fill();
  }
}
