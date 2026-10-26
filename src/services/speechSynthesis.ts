// Natural Speech Synthesis & Priority Queue Manager
import type { SpeechQueueItem } from '../types';

export type SpeakingCallback = (speaking: boolean, currentText: string) => void;

class SpeechManager {
  private synth: SpeechSynthesis | null = null;
  private voices: SpeechSynthesisVoice[] = [];
  private selectedVoice: SpeechSynthesisVoice | null = null;
  private isSpeaking = false;
  private currentUtterance: SpeechSynthesisUtterance | null = null;
  private queue: SpeechQueueItem[] = [];
  private speakingCallbacks: Set<SpeakingCallback> = new Set();
  private keepAliveTimer: any = null;
  private speechTimeoutTimer: any = null;

  private lastBackgroundSpokenTime = 0;
  private lastSpokenText = '';
  private readonly backgroundCooldownMs = 4000; // 4 seconds between non-urgent updates

  private rate = 1.05;
  private pitch = 1.0;
  private volume = 1.0;

  constructor() {
    if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
      this.synth = window.speechSynthesis;
      this.initVoices();
      if (this.synth.onvoiceschanged !== undefined) {
        this.synth.onvoiceschanged = () => this.initVoices();
      }
    }
  }

  private initVoices(): void {
    if (!this.synth) return;
    this.voices = this.synth.getVoices();
    this.selectBestVoice();
  }

  private selectBestVoice(preferredURI?: string): void {
    if (!this.voices.length) return;

    if (preferredURI) {
      const match = this.voices.find((v) => v.voiceURI === preferredURI);
      if (match) {
        this.selectedVoice = match;
        return;
      }
    }

    // High-priority natural Google Assistant / Gemini-style voices
    const preferredNames = [
      'Google US English',
      'Google UK English Female',
      'Google UK English Male',
      'Microsoft Jenny Online (Natural)',
      'Microsoft Guy Online (Natural)',
      'Samantha',
      'Victoria',
      'Alex',
      'Karen',
    ];

    for (const name of preferredNames) {
      const found = this.voices.find((v) => v.name.includes(name));
      if (found) {
        this.selectedVoice = found;
        return;
      }
    }

    // Fallback to any en-US or English voice
    const englishVoice = this.voices.find(
      (v) => v.lang.startsWith('en-US') || v.lang.startsWith('en_US') || v.lang.startsWith('en')
    );
    this.selectedVoice = englishVoice || this.voices[0] || null;
  }

  public getVoices(): SpeechSynthesisVoice[] {
    return this.voices;
  }

  public setVoiceByURI(uri: string): void {
    this.selectBestVoice(uri);
  }

  public setRate(rate: number): void {
    this.rate = Math.max(0.7, Math.min(2.0, rate));
  }

  public setPitch(pitch: number): void {
    this.pitch = Math.max(0.5, Math.min(1.5, pitch));
  }

  public setVolume(volume: number): void {
    this.volume = Math.max(0, Math.min(1.0, volume));
  }

  public onSpeakingChange(cb: SpeakingCallback): () => void {
    this.speakingCallbacks.add(cb);
    return () => this.speakingCallbacks.delete(cb);
  }

  private notifySpeaking(speaking: boolean, text = ''): void {
    this.isSpeaking = speaking;
    this.speakingCallbacks.forEach((cb) => {
      try {
        cb(speaking, text);
      } catch {
        // Callback fail-safe
      }
    });
  }

  public getIsSpeaking(): boolean {
    return this.isSpeaking || (this.synth ? this.synth.speaking : false);
  }

  /**
   * Speak immediately for urgent alerts (e.g. Danger < 1.2m or Emergency Stop)
   */
  public speakUrgent(text: string): void {
    if (!this.synth) return;

    // Immediately stop ongoing speech
    this.cancelAll();

    const item: SpeechQueueItem = {
      id: Math.random().toString(36).substring(7),
      text,
      priority: 'urgent',
      createdAt: Date.now(),
    };

    this.queue.unshift(item);
    this.processQueue();
  }

  /**
   * Conversational reply to user questions (e.g. "Where is the chair?")
   */
  public speakReply(text: string): void {
    if (!this.synth) return;

    // Clear background queue items and cancel current non-urgent speech
    this.queue = this.queue.filter((q) => q.priority === 'urgent');
    if (this.currentUtterance && !this.queue.some((q) => q.priority === 'urgent')) {
      this.cancelCurrent();
    }

    const item: SpeechQueueItem = {
      id: Math.random().toString(36).substring(7),
      text,
      priority: 'interactive',
      createdAt: Date.now(),
    };

    this.queue.push(item);
    this.processQueue();
  }

  /**
   * Background navigation updates (e.g. "Chair at 12 o'clock, 2 meters ahead")
   * Subject to 4s cooldown and deduplication.
   */
  public speakBackground(text: string): void {
    if (!this.synth) return;

    const now = Date.now();
    // Prevent repeating identical sentence or talking too frequently
    if (text === this.lastSpokenText && now - this.lastBackgroundSpokenTime < 7000) {
      return;
    }
    if (now - this.lastBackgroundSpokenTime < this.backgroundCooldownMs) {
      return;
    }
    if (this.isSpeaking || this.queue.length > 0) {
      return; // Do not interrupt existing speech with background chatter
    }

    const item: SpeechQueueItem = {
      id: Math.random().toString(36).substring(7),
      text,
      priority: 'background',
      createdAt: now,
    };

    this.queue.push(item);
    this.processQueue();
  }

  private processQueue(): void {
    if (!this.synth) return;
    if (this.isSpeaking && this.synth.speaking) return;
    if (this.queue.length === 0) {
      this.notifySpeaking(false, '');
      return;
    }

    // Sort queue by priority: urgent (0) > interactive (1) > background (2)
    const priorityWeight: Record<SpeechQueueItem['priority'], number> = {
      urgent: 0,
      interactive: 1,
      background: 2,
    };
    this.queue.sort((a, b) => priorityWeight[a.priority] - priorityWeight[b.priority]);

    const nextItem = this.queue.shift();
    if (!nextItem) return;

    // If item has expired (older than 10s for background), skip
    if (nextItem.priority === 'background' && Date.now() - nextItem.createdAt > 10000) {
      this.processQueue();
      return;
    }

    this.executeUtterance(nextItem);
  }

  private executeUtterance(item: SpeechQueueItem): void {
    if (!this.synth) return;

    try {
      // Resume synth in case browser paused it
      if (this.synth.paused) {
        this.synth.resume();
      }

      const utterance = new SpeechSynthesisUtterance(item.text);
      if (this.selectedVoice) {
        utterance.voice = this.selectedVoice;
      }
      utterance.rate = this.rate;
      utterance.pitch = this.pitch;
      utterance.volume = this.volume;

      const clearWatchdogs = () => {
        if (this.keepAliveTimer) {
          clearInterval(this.keepAliveTimer);
          this.keepAliveTimer = null;
        }
        if (this.speechTimeoutTimer) {
          clearTimeout(this.speechTimeoutTimer);
          this.speechTimeoutTimer = null;
        }
      };

      utterance.onstart = () => {
        this.isSpeaking = true;
        this.currentUtterance = utterance;
        this.notifySpeaking(true, item.text);

        clearWatchdogs();

        // Chromium Keep-Alive: Chrome pauses long SpeechSynthesis utterances after ~14s
        this.keepAliveTimer = setInterval(() => {
          if (this.synth && this.isSpeaking) {
            try {
              this.synth.pause();
              this.synth.resume();
            } catch {
              // Ignore
            }
          }
        }, 10000);

        // Fail-safe watchdog: force cleanup if browser gets stuck without onend
        const maxDurationMs = Math.max(6000, Math.min(30000, item.text.length * 150));
        this.speechTimeoutTimer = setTimeout(() => {
          if (this.isSpeaking && this.currentUtterance === utterance) {
            clearWatchdogs();
            this.cancelCurrent();
            setTimeout(() => this.processQueue(), 100);
          }
        }, maxDurationMs);
      };

      utterance.onend = () => {
        clearWatchdogs();
        this.isSpeaking = false;
        this.currentUtterance = null;
        this.lastSpokenText = item.text;
        if (item.priority === 'background') {
          this.lastBackgroundSpokenTime = Date.now();
        }
        this.notifySpeaking(false, '');
        // Process next item with slight safety delay
        setTimeout(() => this.processQueue(), 120);
      };

      utterance.onerror = (e) => {
        clearWatchdogs();
        // If canceled intentionally, ignore
        this.isSpeaking = false;
        this.currentUtterance = null;
        this.notifySpeaking(false, '');
        if (e.error !== 'canceled' && e.error !== 'interrupted') {
          setTimeout(() => this.processQueue(), 150);
        }
      };

      this.currentUtterance = utterance;
      this.synth.speak(utterance);
    } catch {
      if (this.keepAliveTimer) {
        clearInterval(this.keepAliveTimer);
        this.keepAliveTimer = null;
      }
      if (this.speechTimeoutTimer) {
        clearTimeout(this.speechTimeoutTimer);
        this.speechTimeoutTimer = null;
      }
      this.isSpeaking = false;
      this.notifySpeaking(false, '');
    }
  }

  public cancelCurrent(): void {
    if (this.keepAliveTimer) {
      clearInterval(this.keepAliveTimer);
      this.keepAliveTimer = null;
    }
    if (this.speechTimeoutTimer) {
      clearTimeout(this.speechTimeoutTimer);
      this.speechTimeoutTimer = null;
    }
    if (this.synth) {
      try {
        this.synth.cancel();
      } catch {
        // Ignore
      }
    }
    this.isSpeaking = false;
    this.currentUtterance = null;
    this.notifySpeaking(false, '');
  }

  public cancelAll(): void {
    this.queue = [];
    this.cancelCurrent();
  }
}

export const speechManager = new SpeechManager();
