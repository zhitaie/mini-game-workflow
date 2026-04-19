type SkiBgmMode = 'none' | 'home' | 'run' | 'result';

export class SkiAudioDirector {
  private audioContext: AudioContext | null = null;
  private masterGain: GainNode | null = null;
  private bgmGain: GainNode | null = null;
  private bgmOscillators: OscillatorNode[] = [];
  private bgmMode: SkiBgmMode = 'none';
  private enabled = true;

  setAudioEnabled(enabled: boolean): void {
    this.enabled = enabled;

    if (!enabled) {
      this.stopBgm();
      if (this.masterGain && this.audioContext) {
        this.masterGain.gain.cancelScheduledValues(this.audioContext.currentTime);
        this.masterGain.gain.setValueAtTime(0.0001, this.audioContext.currentTime);
      }
      return;
    }

    const context = this.ensureContext();
    if (!context || !this.masterGain) {
      return;
    }

    this.masterGain.gain.cancelScheduledValues(context.currentTime);
    this.masterGain.gain.setValueAtTime(0.2, context.currentTime);
    this.setBgmMode(this.bgmMode);
  }

  unlock(): void {
    const context = this.ensureContext();
    if (!context || !this.enabled) {
      return;
    }

    if (context.state === 'suspended') {
      void context.resume();
    }

    if (this.bgmMode !== 'none' && this.bgmOscillators.length === 0) {
      this.setBgmMode(this.bgmMode);
    }
  }

  setBgmMode(mode: SkiBgmMode): void {
    this.bgmMode = mode;

    if (!this.enabled) {
      return;
    }

    const context = this.ensureContext();
    if (!context || !this.masterGain) {
      return;
    }

    this.stopBgm();

    if (mode === 'none') {
      return;
    }

    this.bgmGain = context.createGain();
    this.bgmGain.gain.setValueAtTime(0.0001, context.currentTime);
    this.bgmGain.connect(this.masterGain);

    const configs =
      mode === 'home'
        ? [
            { frequency: 196, type: 'sine' as OscillatorType, gain: 0.05 },
            { frequency: 293.66, type: 'triangle' as OscillatorType, gain: 0.024 }
          ]
        : mode === 'run'
          ? [
              { frequency: 110, type: 'sawtooth' as OscillatorType, gain: 0.042 },
              { frequency: 220, type: 'triangle' as OscillatorType, gain: 0.02 }
            ]
          : [
              { frequency: 164.81, type: 'triangle' as OscillatorType, gain: 0.036 },
              { frequency: 246.94, type: 'sine' as OscillatorType, gain: 0.018 }
            ];

    for (const config of configs) {
      const oscillator = context.createOscillator();
      const gainNode = context.createGain();
      oscillator.type = config.type;
      oscillator.frequency.setValueAtTime(config.frequency, context.currentTime);
      gainNode.gain.setValueAtTime(config.gain, context.currentTime);
      oscillator.connect(gainNode);
      gainNode.connect(this.bgmGain);
      oscillator.start();
      this.bgmOscillators.push(oscillator);
    }

    this.bgmGain.gain.exponentialRampToValueAtTime(1, context.currentTime + 0.28);
  }

  playButton(): void {
    this.playTone(540, 0.08, 'triangle', 0.03);
  }

  playCoin(): void {
    this.playTone(940, 0.06, 'triangle', 0.035);
    this.playTone(1280, 0.08, 'sine', 0.02, 0.04);
  }

  playCrash(): void {
    this.playTone(130, 0.18, 'sawtooth', 0.05);
    this.playTone(92, 0.22, 'triangle', 0.04, 0.03);
  }

  playRevive(): void {
    this.playTone(392, 0.1, 'triangle', 0.03);
    this.playTone(523.25, 0.12, 'triangle', 0.028, 0.06);
    this.playTone(659.25, 0.12, 'sine', 0.022, 0.12);
  }

  playReward(): void {
    this.playTone(523.25, 0.08, 'triangle', 0.03);
    this.playTone(659.25, 0.1, 'triangle', 0.028, 0.05);
    this.playTone(783.99, 0.12, 'sine', 0.024, 0.1);
  }

  playRestart(): void {
    this.playTone(320, 0.05, 'triangle', 0.028);
    this.playTone(440, 0.08, 'triangle', 0.025, 0.05);
  }

  dispose(): void {
    this.stopBgm();
  }

  private playTone(
    frequency: number,
    duration: number,
    type: OscillatorType,
    volume: number,
    delay = 0
  ): void {
    if (!this.enabled) {
      return;
    }

    const context = this.ensureContext();
    if (!context || !this.masterGain) {
      return;
    }

    const start = context.currentTime + delay;
    const oscillator = context.createOscillator();
    const gainNode = context.createGain();
    oscillator.type = type;
    oscillator.frequency.setValueAtTime(frequency, start);
    gainNode.gain.setValueAtTime(0.0001, start);
    gainNode.gain.exponentialRampToValueAtTime(volume, start + 0.01);
    gainNode.gain.exponentialRampToValueAtTime(0.0001, start + duration);
    oscillator.connect(gainNode);
    gainNode.connect(this.masterGain);
    oscillator.start(start);
    oscillator.stop(start + duration + 0.02);
  }

  private ensureContext(): AudioContext | null {
    if (typeof window === 'undefined') {
      return null;
    }

    if (!this.audioContext) {
      const AudioContextCtor = window.AudioContext ?? (window as Window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
      if (!AudioContextCtor) {
        return null;
      }

      this.audioContext = new AudioContextCtor();
      this.masterGain = this.audioContext.createGain();
      this.masterGain.gain.setValueAtTime(0.2, this.audioContext.currentTime);
      this.masterGain.connect(this.audioContext.destination);
    }

    if (this.audioContext.state === 'suspended') {
      void this.audioContext.resume();
    }

    return this.audioContext;
  }

  private stopBgm(): void {
    for (const oscillator of this.bgmOscillators) {
      try {
        oscillator.stop();
      } catch {
        // Ignore repeated stop on disposed nodes.
      }
      oscillator.disconnect();
    }
    this.bgmOscillators = [];

    if (this.bgmGain && this.audioContext) {
      this.bgmGain.gain.cancelScheduledValues(this.audioContext.currentTime);
      this.bgmGain.gain.setValueAtTime(this.bgmGain.gain.value || 0.0001, this.audioContext.currentTime);
      this.bgmGain.gain.exponentialRampToValueAtTime(0.0001, this.audioContext.currentTime + 0.08);
      this.bgmGain.disconnect();
    }

    this.bgmGain = null;
  }
}
