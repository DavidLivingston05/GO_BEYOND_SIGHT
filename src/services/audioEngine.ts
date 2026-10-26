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

  /**
   * Reassuring "Clear Path" harmonic chime
   * Informs a blind user that their walking corridor is completely unobstructed for 3+ meters.
   */
  public playClearPathChime(): void {
    try {
      const ctx = this.getAudioContext();
      const now = ctx.currentTime;

      // Gentle C5-G5 fifth chord with soft attack and decay
      [523.25, 783.99].forEach((freq) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(freq, now);

        gain.gain.setValueAtTime(0, now);
        gain.gain.linearRampToValueAtTime(0.12, now + 0.06);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.35);

        osc.connect(gain);
        gain.connect(this.masterGain || ctx.destination);

        osc.start(now);
        osc.stop(now + 0.38);
      });
    } catch {
      // Fallback
    }
  }

  /**
   * Binaural Target-Seeker "Acoustic Homing" Sonar Ping
   * Panned left/right into user's ears/headphones based on object position.
   * Pitch rises as user gets closer; centers and plays pleasant bell tone with haptic vibration when aimed straight ahead.
   */
  public playTargetSeekerPing(distanceRatio: number, isCentered: boolean, panValue = 0): void {
    try {
      // Haptic tactile pulse when locked directly onto target
      if (isCentered && typeof navigator !== 'undefined' && 'vibrate' in navigator) {
        try {
          navigator.vibrate([35, 45, 40]);
        } catch {
          // Vibration ignore
        }
      }

      const ctx = this.getAudioContext();
      const now = ctx.currentTime;

      // Pitch ranges from 600Hz (far) up to 1350Hz (close); centered adds warm harmonic
      const baseFreq = 620 + (1 - Math.min(1, Math.max(0, distanceRatio))) * 600 + (isCentered ? 280 : 0);
      const vol = isCentered ? 0.32 : 0.2;
      const duration = isCentered ? 0.12 : 0.06;

      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = isCentered ? 'triangle' : 'sine';
      osc.frequency.setValueAtTime(baseFreq, now);

      gain.gain.setValueAtTime(0, now);
      gain.gain.linearRampToValueAtTime(vol, now + 0.008);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + duration);

      // Stereo panning node for true binaural homing into headphones
      const clampedPan = Math.max(-1, Math.min(1, panValue));
      if (typeof ctx.createStereoPanner === 'function') {
        const panner = ctx.createStereoPanner();
        panner.pan.setValueAtTime(clampedPan, now);
        osc.connect(gain);
        gain.connect(panner);
        panner.connect(this.masterGain || ctx.destination);
      } else {
        osc.connect(gain);
        gain.connect(this.masterGain || ctx.destination);
      }

      osc.start(now);
      osc.stop(now + duration + 0.02);
    } catch {
      // Fallback
    }
  }

  /**
   * Tactile touch gesture feedback sound + vibration
   * Vital for blind navigation so every tap/swipe has an instant physical acknowledgement.
   */
  public playGestureFeedback(type: 'tap' | 'double_tap' | 'long_press' | 'swipe' | 'curtain'): void {
    try {
      // Haptic pulse
      if (typeof navigator !== 'undefined' && 'vibrate' in navigator) {
        try {
          if (type === 'tap') navigator.vibrate(25);
          else if (type === 'double_tap') navigator.vibrate([30, 40, 30]);
          else if (type === 'long_press') navigator.vibrate(70);
          else if (type === 'swipe') navigator.vibrate(35);
          else if (type === 'curtain') navigator.vibrate([50, 60, 80]);
        } catch {
          // Ignored
        }
      }

      const ctx = this.getAudioContext();
      const now = ctx.currentTime;

      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';

      let freq = 600;
      let duration = 0.04;
      if (type === 'double_tap') {
        freq = 840;
        duration = 0.06;
      } else if (type === 'long_press') {
        freq = 440;
        duration = 0.1;
      } else if (type === 'swipe') {
        freq = 720;
        duration = 0.05;
      } else if (type === 'curtain') {
        freq = 320;
        duration = 0.12;
      }

      osc.frequency.setValueAtTime(freq, now);
      gain.gain.setValueAtTime(0, now);
      gain.gain.linearRampToValueAtTime(0.25, now + 0.006);
      gain.gain.exponentialRampToValueAtTime(0.001, now + duration);

      osc.connect(gain);
      gain.connect(this.masterGain || ctx.destination);

      osc.start(now);
      osc.stop(now + duration + 0.01);
    } catch {
      // Fallback
    }
  }

  /**
   * Flashlight / Torch toggle sound
   */
  public playTorchSound(isOn: boolean): void {
    try {
      if (typeof navigator !== 'undefined' && 'vibrate' in navigator) {
        try {
          navigator.vibrate(40);
        } catch {
          // Ignore
        }
      }
      const ctx = this.getAudioContext();
      const now = ctx.currentTime;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(isOn ? 880 : 440, now);
      osc.frequency.setValueAtTime(isOn ? 1174 : 330, now + 0.04);

      gain.gain.setValueAtTime(0.25, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.1);

      osc.connect(gain);
      gain.connect(this.masterGain || ctx.destination);

      osc.start(now);
      osc.stop(now + 0.12);
    } catch {
      // Fallback
    }
  }

  /**
   * Urgent Approaching Vehicle Doppler Siren (Road Safety Sentinel)
   * Sweeps pitch up & down to warn blind user of an incoming moving vehicle.
   */
  public playApproachingVehicleSiren(zone: SpatialZone = 'center'): void {
    try {
      if (typeof navigator !== 'undefined' && 'vibrate' in navigator) {
        try {
          navigator.vibrate([400, 100, 400]);
        } catch {
          // Ignore
        }
      }

      const ctx = this.getAudioContext();
      const now = ctx.currentTime;

      let panValue = 0;
      if (zone === 'left') panValue = -0.75;
      if (zone === 'right') panValue = 0.75;

      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sawtooth';

      // Pitch sweeps up from 550Hz to 1100Hz (Doppler effect)
      osc.frequency.setValueAtTime(550, now);
      osc.frequency.exponentialRampToValueAtTime(1150, now + 0.15);
      osc.frequency.exponentialRampToValueAtTime(650, now + 0.35);

      gain.gain.setValueAtTime(0, now);
      gain.gain.linearRampToValueAtTime(0.6, now + 0.04);
      gain.gain.exponentialRampToValueAtTime(0.01, now + 0.36);

      if (typeof ctx.createStereoPanner === 'function') {
        const panner = ctx.createStereoPanner();
        panner.pan.setValueAtTime(panValue, now);
        osc.connect(gain);
        gain.connect(panner);
        panner.connect(this.masterGain || ctx.destination);
      } else {
        osc.connect(gain);
        gain.connect(this.masterGain || ctx.destination);
      }

      osc.start(now);
      osc.stop(now + 0.38);
    } catch {
      // Fallback
    }
  }

  /**
   * Accessible Pedestrian Signal (APS) Street Crossing Audio
   * Rapid chirping bird sound for Walk (Green) / Steady pulse for Wait (Red)
   */
  public playTrafficLightAPS(state: 'green' | 'red'): void {
    try {
      const ctx = this.getAudioContext();
      const now = ctx.currentTime;

      if (state === 'green') {
        // Rapid 2-burst chirp for Walk Signal
        [0, 0.08].forEach((offset) => {
          const osc = ctx.createOscillator();
          const gain = ctx.createGain();
          osc.type = 'sine';
          osc.frequency.setValueAtTime(1600, now + offset);
          osc.frequency.exponentialRampToValueAtTime(2400, now + offset + 0.05);

          gain.gain.setValueAtTime(0.35, now + offset);
          gain.gain.exponentialRampToValueAtTime(0.001, now + offset + 0.06);

          osc.connect(gain);
          gain.connect(this.masterGain || ctx.destination);

          osc.start(now + offset);
          osc.stop(now + offset + 0.07);
        });
      } else {
        // Low woodblock tap for Wait / Don't Walk (Red)
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = 'triangle';
        osc.frequency.setValueAtTime(480, now);
        osc.frequency.exponentialRampToValueAtTime(240, now + 0.06);

        gain.gain.setValueAtTime(0.3, now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.07);

        osc.connect(gain);
        gain.connect(this.masterGain || ctx.destination);

        osc.start(now);
        osc.stop(now + 0.08);
      }
    } catch {
      // Fallback
    }
  }

  /**
   * Door & Portal Acoustic Homing Beacon
   * Produces a pure resonant lock tone when phone is pointed dead-center at the door (offset < 10 deg)
   */
  public playDoorHomingBeacon(isAligned: boolean, turnOffsetDeg: number): void {
    try {
      const ctx = this.getAudioContext();
      const now = ctx.currentTime;

      const osc = ctx.createOscillator();
      const gain = ctx.createGain();

      if (isAligned) {
        // Crystal resonant lock tone
        osc.type = 'sine';
        osc.frequency.setValueAtTime(987.77, now); // B5 pure chord tone
        gain.gain.setValueAtTime(0.35, now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.22);
      } else {
        // Directional panning guiding user to turn left or right
        const panValue = Math.max(-0.8, Math.min(0.8, turnOffsetDeg / 30));
        osc.type = 'triangle';
        osc.frequency.setValueAtTime(659.25, now); // E5

        gain.gain.setValueAtTime(0.2, now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.09);

        if (typeof ctx.createStereoPanner === 'function') {
          const panner = ctx.createStereoPanner();
          panner.pan.setValueAtTime(panValue, now);
          osc.connect(gain);
          gain.connect(panner);
          panner.connect(this.masterGain || ctx.destination);
          osc.start(now);
          osc.stop(now + 0.1);
          return;
        }
      }

      osc.connect(gain);
      gain.connect(this.masterGain || ctx.destination);
      osc.start(now);
      osc.stop(now + 0.24);
    } catch {
      // Fallback
    }
  }

  /**
   * Crosswalk / Zebra Crossing Confirmation Sound
   */
  public playCrosswalkChime(): void {
    try {
      if (typeof navigator !== 'undefined' && 'vibrate' in navigator) {
        try {
          navigator.vibrate([80, 50, 80]);
        } catch {
          // Ignore
        }
      }
      const ctx = this.getAudioContext();
      const now = ctx.currentTime;

      // Two ascending bell notes (F5 -> C6)
      [0, 0.1].forEach((offset, idx) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(idx === 0 ? 698.46 : 1046.5, now + offset);

        gain.gain.setValueAtTime(0.3, now + offset);
        gain.gain.exponentialRampToValueAtTime(0.001, now + offset + 0.2);

        osc.connect(gain);
        gain.connect(this.masterGain || ctx.destination);

        osc.start(now + offset);
        osc.stop(now + offset + 0.22);
      });
    } catch {
      // Fallback
    }
  }
}

export const audioEngine = new AudioEngine();
