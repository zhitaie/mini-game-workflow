import { AudioClip, AudioSource, Node, resources } from 'cc';

type SkiBgmMode = 'none' | 'home' | 'run' | 'result';
type SkiBgmAssetKey = Exclude<SkiBgmMode, 'none'>;
type SkiSfxAssetKey = 'button' | 'coin' | 'crash' | 'lane' | 'restart' | 'revive' | 'reward';

const BGM_PATHS: Record<SkiBgmAssetKey, string[]> = {
  home: ['ski/audio/bgm/home-loop'],
  run: ['ski/audio/bgm/run-loop'],
  result: ['ski/audio/bgm/result-loop']
};

const SFX_PATHS: Record<SkiSfxAssetKey, string[]> = {
  button: ['ski/audio/sfx/ui-click-sfx', 'ski/audio/sfx/ui-click'],
  coin: ['ski/audio/sfx/coin-sfx', 'ski/audio/sfx/coin'],
  crash: ['ski/audio/sfx/crash-sfx', 'ski/audio/sfx/crash'],
  lane: ['ski/audio/sfx/lane-shift-sfx', 'ski/audio/sfx/lane-shift'],
  restart: ['ski/audio/sfx/ui-click-sfx', 'ski/audio/sfx/ui-click'],
  revive: ['ski/audio/sfx/ui-click-sfx', 'ski/audio/sfx/ui-click'],
  reward: ['ski/audio/sfx/ui-click-sfx', 'ski/audio/sfx/ui-click']
};

const BGM_VOLUMES: Record<SkiBgmAssetKey, number> = {
  home: 0.5,
  run: 0.58,
  result: 0.46
};

const SFX_VOLUMES: Record<SkiSfxAssetKey, number> = {
  button: 0.8,
  coin: 0.92,
  crash: 0.88,
  lane: 0.72,
  restart: 0.74,
  revive: 0.8,
  reward: 0.84
};

export class SkiAudioDirector {
  private hostNode: Node | null = null;
  private bgmSource: AudioSource | null = null;
  private sfxSource: AudioSource | null = null;
  private readonly clipCache = new Map<string, AudioClip | null>();
  private readonly pendingLoads = new Map<string, Promise<AudioClip | null>>();
  private bgmMode: SkiBgmMode = 'none';
  private enabled = true;
  private unlocked = false;
  private activeBgmPath: string | null = null;

  attachHost(hostNode: Node): void {
    if (this.hostNode === hostNode && this.bgmSource && this.sfxSource) {
      return;
    }

    this.hostNode = hostNode;

    const bgmNode = hostNode.getChildByName('AudioBgm') ?? new Node('AudioBgm');
    if (!bgmNode.parent) {
      hostNode.addChild(bgmNode);
    }

    const sfxNode = hostNode.getChildByName('AudioSfx') ?? new Node('AudioSfx');
    if (!sfxNode.parent) {
      hostNode.addChild(sfxNode);
    }

    this.bgmSource = bgmNode.getComponent(AudioSource) ?? bgmNode.addComponent(AudioSource);
    this.sfxSource = sfxNode.getComponent(AudioSource) ?? sfxNode.addComponent(AudioSource);
    this.bgmSource.loop = true;
    this.bgmSource.playOnAwake = false;
    this.sfxSource.playOnAwake = false;
    this.bgmSource.volume = 0;
    this.sfxSource.volume = 1;
  }

  preload(): void {
    void Promise.all([
      ...Object.values(BGM_PATHS).map((paths) => this.loadClip(paths)),
      ...Object.values(SFX_PATHS).map((paths) => this.loadClip(paths))
    ]);
  }

  setAudioEnabled(enabled: boolean): void {
    this.enabled = enabled;

    if (!enabled) {
      this.stopBgm();
      return;
    }

    if (this.unlocked) {
      void this.applyBgmMode();
    }
  }

  unlock(): void {
    this.unlocked = true;
    if (this.enabled) {
      void this.applyBgmMode();
    }
  }

  setBgmMode(mode: SkiBgmMode): void {
    this.bgmMode = mode;
    if (this.enabled && this.unlocked) {
      void this.applyBgmMode();
    }
  }

  playButton(): void {
    void this.playSfx('button');
  }

  playCoin(): void {
    void this.playSfx('coin');
  }

  playCrash(): void {
    void this.playSfx('crash');
  }

  playLaneShift(): void {
    void this.playSfx('lane');
  }

  playRevive(): void {
    void this.playSfx('revive');
  }

  playReward(): void {
    void this.playSfx('reward');
  }

  playRestart(): void {
    void this.playSfx('restart');
  }

  dispose(): void {
    this.stopBgm();
    this.bgmSource = null;
    this.sfxSource = null;
    this.hostNode = null;
  }

  private async applyBgmMode(): Promise<void> {
    if (!this.enabled || !this.unlocked || !this.bgmSource) {
      return;
    }

    if (this.bgmMode === 'none') {
      this.stopBgm();
      return;
    }

    const requestedMode = this.bgmMode;
    const paths = BGM_PATHS[requestedMode];
    const clip = await this.loadClip(paths);
    const path = clip ? this.resolveLoadedPath(paths) : null;

    if (!clip || !path || !this.bgmSource || this.bgmMode !== requestedMode || !this.enabled || !this.unlocked) {
      return;
    }

    if (this.activeBgmPath === path && this.bgmSource.playing) {
      this.bgmSource.volume = BGM_VOLUMES[requestedMode];
      return;
    }

    this.bgmSource.stop();
    this.bgmSource.clip = clip;
    this.bgmSource.loop = true;
    this.bgmSource.volume = BGM_VOLUMES[requestedMode];
    this.bgmSource.play();
    this.activeBgmPath = path;
  }

  private async playSfx(key: SkiSfxAssetKey): Promise<void> {
    if (!this.enabled || !this.unlocked || !this.sfxSource) {
      return;
    }

    const clip = await this.loadClip(SFX_PATHS[key]);
    if (!clip || !this.sfxSource || !this.enabled || !this.unlocked) {
      return;
    }

    this.sfxSource.playOneShot(clip, SFX_VOLUMES[key]);
  }

  private async loadClip(paths: string | string[]): Promise<AudioClip | null> {
    const candidates = Array.isArray(paths) ? paths : [paths];

    for (const path of candidates) {
      const clip = await this.loadSingleClip(path);
      if (clip) {
        return clip;
      }
    }

    return null;
  }

  private resolveLoadedPath(paths: string[]): string | null {
    for (const path of paths) {
      if (this.clipCache.get(path)) {
        return path;
      }
    }

    return null;
  }

  private loadSingleClip(path: string): Promise<AudioClip | null> {
    const cached = this.clipCache.get(path);
    if (cached !== undefined) {
      return Promise.resolve(cached);
    }

    const pending = this.pendingLoads.get(path);
    if (pending) {
      return pending;
    }

    const loadPromise = new Promise<AudioClip | null>((resolve) => {
      resources.load(path, AudioClip, (error, clip) => {
        if (error) {
          this.clipCache.set(path, null);
          this.pendingLoads.delete(path);
          resolve(null);
          return;
        }

        this.clipCache.set(path, clip);
        this.pendingLoads.delete(path);
        resolve(clip);
      });
    });

    this.pendingLoads.set(path, loadPromise);
    return loadPromise;
  }

  private stopBgm(): void {
    if (!this.bgmSource) {
      this.activeBgmPath = null;
      return;
    }

    this.bgmSource.stop();
    this.bgmSource.clip = null;
    this.bgmSource.volume = 0;
    this.activeBgmPath = null;
  }
}
