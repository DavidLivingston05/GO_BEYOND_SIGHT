// Offline Test Harness: Simulates Network Connectivity States
// Simulates Offline, Online, Degraded/Flaky networks to verify transitions and audio earcons
import type { ConnectivityState } from '../../types';
import { connectivityMonitor } from './ConnectivityMonitor';
import { speechManager } from '../speechSynthesis';

export class OfflineTestHarness {
  private isSimulating = false;
  private currentSimulationState: ConnectivityState | null = null;
  private flakyIntervalId: number | null = null;

  public getIsSimulating(): boolean {
    return this.isSimulating;
  }

  public getCurrentState(): ConnectivityState | null {
    return this.currentSimulationState;
  }

  /**
   * Simulates full offline disconnect (Airplane Mode / Subway Basement)
   */
  public simulateOffline(): void {
    this.stopFlakyInterval();
    this.isSimulating = true;
    this.currentSimulationState = 'offline';
    connectivityMonitor.setSimulationOverride('offline');
  }

  /**
   * Simulates online restoration (WiFi / 5G Reconnected)
   */
  public simulateOnline(): void {
    this.stopFlakyInterval();
    this.isSimulating = true;
    this.currentSimulationState = 'online';
    connectivityMonitor.setSimulationOverride('online');
  }

  /**
   * Simulates degraded/flaky high-latency connection (elevator transit or weak cell edge)
   */
  public simulateDegraded(): void {
    this.stopFlakyInterval();
    this.isSimulating = true;
    this.currentSimulationState = 'degraded';
    connectivityMonitor.setSimulationOverride('degraded');
    speechManager.speakReply('Simulating degraded high-latency connection.');
  }

  /**
   * Simulates fluctuating signal (alternating online/offline to test hysteresis prevention)
   */
  public simulateFlaky(): void {
    this.isSimulating = true;
    speechManager.speakReply('Simulating flaky network. Hysteresis should prevent rapid alert loops.');

    let toggle = false;
    this.flakyIntervalId = window.setInterval(() => {
      toggle = !toggle;
      connectivityMonitor.setSimulationOverride(toggle ? 'degraded' : 'online');
    }, 2000);
  }

  /**
   * Resets simulation and returns to actual network state
   */
  public reset(): void {
    this.stopFlakyInterval();
    this.isSimulating = false;
    this.currentSimulationState = null;
    connectivityMonitor.setSimulationOverride(null);
    speechManager.speakReply('Network simulation ended. Real-time connectivity monitoring active.');
  }

  private stopFlakyInterval(): void {
    if (this.flakyIntervalId) {
      clearInterval(this.flakyIntervalId);
      this.flakyIntervalId = null;
    }
  }
}

export const offlineTestHarness = new OfflineTestHarness();
