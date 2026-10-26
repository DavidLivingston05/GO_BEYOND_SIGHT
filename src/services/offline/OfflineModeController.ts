// Offline Mode Controller: Manages seamless automatic transitions
// Handles distinct earcons, spoken announcements, and mode persistence across network switches
import type { ConnectivityState, NavigationMode } from '../../types';
import { connectivityMonitor } from './ConnectivityMonitor';
import { audioEngine } from '../audioEngine';
import { speechManager } from '../speechSynthesis';
import { offlineVoiceService } from './OfflineVoice';
import { offlineQueueService } from './OfflineQueue';

export type OfflineModeListener = (isOffline: boolean) => void;

export class OfflineModeController {
  private isOffline = false;
  private previousMode: NavigationMode = 'home';
  private listeners: Set<OfflineModeListener> = new Set();
  private hasAnnouncedOffline = false;
  private hasAnnouncedOnline = false;

  constructor() {
    this.init();
  }

  private init(): void {
    connectivityMonitor.subscribe((quality) => {
      this.handleConnectivityChange(quality.state);
    });
  }

  public subscribe(listener: OfflineModeListener): () => void {
    this.listeners.add(listener);
    listener(this.isOffline);
    return () => this.listeners.delete(listener);
  }

  public getIsOffline(): boolean {
    return this.isOffline;
  }

  public setPreviousMode(mode: NavigationMode): void {
    this.previousMode = mode;
  }

  public getPreviousMode(): NavigationMode {
    return this.previousMode;
  }

  private handleConnectivityChange(state: ConnectivityState): void {
    const currentlyOffline = state === 'offline';

    if (currentlyOffline && !this.isOffline) {
      // Transition ONLINE -> OFFLINE
      this.isOffline = true;
      this.hasAnnouncedOnline = false;

      // 1. Cancel pending speech and stop pending cloud calls
      speechManager.cancelAll();

      // 2. Select best offline voice
      offlineVoiceService.selectBestOfflineVoice();

      // 3. Play distinct descending disconnect earcon
      audioEngine.playOfflineDisconnectEarcon();

      // 4. Speak ONE informative announcement
      if (!this.hasAnnouncedOffline) {
        this.hasAnnouncedOffline = true;
        setTimeout(() => {
          speechManager.speakUrgent(
            'No internet. Offline mode on. I can still check your path, describe the room by objects, find objects, and warn about vehicles. Voice commands may be limited; use taps.'
          );
        }, 400);
      }

      this.notify();
    } else if (!currentlyOffline && this.isOffline) {
      // Transition OFFLINE -> ONLINE
      this.isOffline = false;
      this.hasAnnouncedOffline = false;

      // 1. Play ascending harmonic reconnect earcon
      audioEngine.playOnlineReconnectEarcon();

      // 2. Speak online restoration announcement
      if (!this.hasAnnouncedOnline) {
        this.hasAnnouncedOnline = true;
        setTimeout(() => {
          speechManager.speakReply('Back online. Full features restored.');
          // Check if any deferred cloud tasks were queued
          offlineQueueService.handleConnectionRestored();
        }, 400);
      }

      this.notify();
    }
  }

  private notify(): void {
    this.listeners.forEach((l) => {
      try {
        l(this.isOffline);
      } catch {
        // Safe callback execution
      }
    });
  }
}

export const offlineModeController = new OfflineModeController();
