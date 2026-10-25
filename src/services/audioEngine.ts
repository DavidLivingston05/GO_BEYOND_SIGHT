// Web Audio API spatial synthesizer & activation sound engine
import type { ProximityTier, SpatialZone } from '../types';

class AudioEngine {
  private ctx: AudioContext | null = null;
  private masterGain: GainNode | null = null;
  private isUnlocked = false;
  private lastPingTime = 0;
  private readonly minPingIntervalMs = 600; // Prevent spamming ear with ticks

  private getAudioContext(): AudioContext {
    if (!this.ctx) {
      const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      this.ctx = new AudioCtx();
      this.masterGain = this.ctx.createGain();
      this.masterGain.gain.setValueAtTime(0.7, this.ctx.currentTime);
      this.masterGain.connect(this.ctx.destination);
    }
    if (this.ctx.state === 'suspended') {
      this.ctx.resume().catch(() => {});
    }
    return this.ctx;
  }

  public async unlock(): Promise<boolean> {
    try {
      const ctx = this.getAudioContext();
      if (ctx.state === 'suspended') {
        await ctx.resume();
      }
      this.isUnlocked = true;
      return true;
    } catch {
      return false;
    }
  }

  public getIsUnlocked(): boolean {
    return this.isUnlocked;
  }

  public setMasterVolume(vol: number): void {
    if (this.masterGain && this.ctx) {
      const clamped = Math.max(0, Math.min(1, vol));
      this.masterGain.gain.setValueAtTime(clamped, this.ctx.currentTime);
    }
  }

  /**
   * Google Assistant-style 2-tone activation chime:
   * First tone: D5 (587.33Hz) -> Second tone: A5 (880.00Hz)
   */
  public playActivationChime(): void {
    try {
      const ctx = this.getAudioContext();
      const now = ctx.currentTime;

      // Note 1: 587.33 Hz (D5)
      const osc1 = ctx.createOscillator();
      const gain1 = ctx.createGain();
      osc1.type = 'sine';
      osc1.frequency.setValueAtTime(587.33, now);

      gain1.gain.setValueAtTime(0, now);
      gain1.gain.linearRampToValueAtTime(0.35, now + 0.03);
      gain1.gain.exponentialRampToValueAtTime(0.001, now + 0.16);

      osc1.connect(gain1);
      gain1.connect(this.masterGain || ctx.destination);

      osc1.start(now);
      osc1.stop(now + 0.18);

      // Note 2: 880 Hz (A5)
      const osc2 = ctx.createOscillator();
      const gain2 = ctx.createGain();
      osc2.type = 'sine';
      osc2.frequency.setValueAtTime(880.0, now + 0.12);

      gain2.gain.setValueAtTime(0, now + 0.12);
      gain2.gain.linearRampToValueAtTime(0.45, now + 0.15);
      gain2.gain.exponentialRampToValueAtTime(0.001, now + 0.38);

      osc2.connect(gain2);
      gain2.connect(this.masterGain || ctx.destination);

      osc2.start(now + 0.12);
      osc2.stop(now + 0.4);
    } catch {
      // Audio fallback silent fail
    }
  }

  /**
   * Standby / Deactivation chime (descending tone)
   */
  public playDeactivationChime(): void {
    try {
      const ctx = this.getAudioContext();
      const now = ctx.currentTime;

      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(659.25, now); // E5
      osc.frequency.exponentialRampToValueAtTime(329.63, now + 0.25); // E4

      gain.gain.setValueAtTime(0.3, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.25);

      osc.connect(gain);
      gain.connect(this.masterGain || ctx.destination);

      osc.start(now);
      osc.stop(now + 0.28);
    } catch {
      // Audio fallback silent fail
    }
  }

  /**
   * Soft thinking pulse chime
   */
  public playThinkingChime(): void {
    try {
      const ctx = this.getAudioContext();
      const now = ctx.currentTime;

      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(440, now);
      osc.frequency.exponentialRampToValueAtTime(554.37, now + 0.18);

      gain.gain.setValueAtTime(0, now);
      gain.gain.linearRampToValueAtTime(0.2, now + 0.05);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.2);

      osc.connect(gain);
      gain.connect(this.masterGain || ctx.destination);

      osc.start(now);
      osc.stop(now + 0.22);
    } catch {
      // Audio fallback silent fail
    }
  }

  /**
   * 3D Spatial Audio Radar Sonar Ping:
   * Panned left (-0.8), center (0), right (+0.8) based on detected obstacle location.
   */
  public playSpatialRadarPing(zone: SpatialZone, tier: ProximityTier): void {
    const nowMs = Date.now();
    // Throttle non-danger pings
    if (tier !== 'danger' && nowMs - this.lastPingTime < this.minPingIntervalMs) {
      return;
    }
    this.lastPingTime = nowMs;

    try {
      const ctx = this.getAudioContext();
      const now = ctx.currentTime;

      // Determine pan coordinate: left (-0.8), center (0), right (+0.8)
      let panValue = 0;
      if (zone === 'left') panValue = -0.8;
      if (zone === 'right') panValue = 0.8;

      // Higher pitch & shorter decay for closer objects
      let freq = 1200;
      let duration = 0.06;
      let vol = 0.25;

      if (tier === 'danger') {
        freq = 1800;
        duration = 0.12;
        vol = 0.55;
      } else if (tier === 'close') {
        freq = 1400;
        duration = 0.08;
        vol = 0.35;
      } else {
        freq = 950;
        duration = 0.05;
        vol = 0.2;
      }

      const osc = ctx.createOscillator();
      const gain = ctx.createGain();

      osc.type = 'sine';
      osc.frequency.setValueAtTime(freq, now);

      gain.gain.setValueAtTime(0, now);
      gain.gain.linearRampToValueAtTime(vol, now + 0.008);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + duration);

      // Stereo panning node
      if (typeof ctx.createStereoPanner === 'function') {
        const panner = ctx.createStereoPanner();
        panner.pan.setValueAtTime(panValue, now);
        osc.connect(gain);
        gain.connect(panner);
        panner.connect(this.masterGain || ctx.destination);
      } else {
        // Fallback for browsers without StereoPanner
        osc.connect(gain);
        gain.connect(this.masterGain || ctx.destination);
      }

      osc.start(now);
      osc.stop(now + duration + 0.02);
    } catch {
      // Ignore audio context interruption
    }
  }

  /**
   * Immediate Danger Alert Tone + Haptic Vibration
   */
  public playDangerAlert(): void {
    try {
      // Trigger haptic vibration if supported
      if (typeof navigator !== 'undefined' && 'vibrate' in navigator) {
        try {
          navigator.vibrate([300, 100, 300]);
        } catch {
          // Vibration not permitted
        }
      }

      const ctx = this.getAudioContext();
      const now = ctx.currentTime;

      // Urgent two-pulse buzzer
      [0, 0.14].forEach((offset) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = 'sawtooth';
        osc.frequency.setValueAtTime(880, now + offset);
        osc.frequency.exponentialRampToValueAtTime(440, now + offset + 0.1);

        gain.gain.setValueAtTime(0.5, now + offset);
        gain.gain.exponentialRampToValueAtTime(0.01, now + offset + 0.1);

        osc.connect(gain);
        gain.connect(this.masterGain || ctx.destination);

        osc.start(now + offset);
        osc.stop(now + offset + 0.12);
      });
    } catch {
      // Audio fallback silent fail
    }
  }

  /**
   * Success acknowledgement sound
   */
  public playSuccessTone(): void {
    try {
      const ctx = this.getAudioContext();
      const now = ctx.currentTime;

      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(523.25, now); // C5
      osc.frequency.setValueAtTime(659.25, now + 0.08); // E5
      osc.frequency.setValueAtTime(783.99, now + 0.16); // G5

      gain.gain.setValueAtTime(0.3, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.3);

      osc.connect(gain);
      gain.connect(this.masterGain || ctx.destination);

      osc.start(now);
      osc.stop(now + 0.32);
    } catch {
      // Fallback
    }
  }
}

export const audioEngine = new AudioEngine();
