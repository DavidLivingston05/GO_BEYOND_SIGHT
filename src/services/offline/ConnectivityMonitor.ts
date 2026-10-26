// Multi-layer Connectivity Monitor with Active Probe & Hysteresis
// Avoids flapping on weak signal, elevator drops, or basement transit
import type { ConnectivityState, NetworkQuality } from '../../types';

export type ConnectivityListener = (quality: NetworkQuality) => void;

export class ConnectivityMonitor {
  private state: ConnectivityState = 'online';
  private latencyMs = 50;
  private consecutiveFailures = 0;
  private consecutiveSuccesses = 2;
  private listeners: Set<ConnectivityListener> = new Set();
  private probeIntervalId: number | null = null;
  private isChecking = false;
  private simulationOverride: ConnectivityState | null = null;

  private readonly failureThreshold = 3; // 3 consecutive failures to go offline
  private readonly successThreshold = 2; // 2 consecutive successes to come online
  private readonly degradedLatencyThresholdMs = 1800; // >1800ms considered degraded
  private readonly probeIntervalMs = 4000;

  constructor() {
    this.initListeners();
    this.startProbe();
  }

  private initListeners(): void {
    if (typeof window === 'undefined') return;

    window.addEventListener('online', () => {
      // Don't immediately switch without verifying through probe
      this.checkConnectivity();
    });

    window.addEventListener('offline', () => {
      // Increase failure count and verify
      this.consecutiveFailures = Math.max(this.consecutiveFailures, 2);
      this.checkConnectivity();
    });
  }

  public subscribe(listener: ConnectivityListener): () => void {
    this.listeners.add(listener);
    listener(this.getQuality());
    return () => this.listeners.delete(listener);
  }

  public getQuality(): NetworkQuality {
    const effectiveState = this.simulationOverride || this.state;
    return {
      state: effectiveState,
      isOnline: effectiveState === 'online' || effectiveState === 'degraded',
      isDegraded: effectiveState === 'degraded',
      latencyMs: this.latencyMs,
      consecutiveFailures: this.consecutiveFailures,
      consecutiveSuccesses: this.consecutiveSuccesses,
      lastChecked: Date.now(),
    };
  }

  public isOnline(): boolean {
    const s = this.simulationOverride || this.state;
    return s === 'online' || s === 'degraded';
  }

  public isDegraded(): boolean {
    const s = this.simulationOverride || this.state;
    return s === 'degraded';
  }

  public setSimulationOverride(override: ConnectivityState | null): void {
    this.simulationOverride = override;
    this.notify();
  }

  private startProbe(): void {
    if (typeof window === 'undefined') return;
    this.probeIntervalId = window.setInterval(() => {
      this.checkConnectivity();
    }, this.probeIntervalMs);
  }

  public async checkConnectivity(): Promise<NetworkQuality> {
    if (this.isChecking) return this.getQuality();
    this.isChecking = true;

    // Fast check: if navigator.onLine is false, count as a failure immediately
    if (typeof navigator !== 'undefined' && !navigator.onLine) {
      this.handleProbeResult(false, 0);
      this.isChecking = false;
      return this.getQuality();
    }

    const start = Date.now();
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 2200);

      // Probe our own origin ping.json with cache-busting timestamp
      const probeUrl = `/ping.json?t=${start}`;
      const response = await fetch(probeUrl, {
        method: 'GET',
        cache: 'no-store',
        signal: controller.signal,
      });
      clearTimeout(timeoutId);

      const elapsed = Date.now() - start;
      const success = response.ok;
      this.handleProbeResult(success, elapsed);
    } catch {
      // Fallback external lightweight probe if origin fetch failed
      try {
        const extController = new AbortController();
        const extTimeoutId = setTimeout(() => extController.abort(), 1800);
        const extResponse = await fetch('https://dns.google/resolve?name=example.com', {
          method: 'HEAD',
          mode: 'no-cors',
          cache: 'no-store',
          signal: extController.signal,
        });
        clearTimeout(extTimeoutId);
        const elapsed = Date.now() - start;
        this.handleProbeResult(Boolean(extResponse), elapsed);
      } catch {
        const elapsed = Date.now() - start;
        this.handleProbeResult(false, elapsed);
      }
    } finally {
      this.isChecking = false;
    }

    return this.getQuality();
  }

  private handleProbeResult(success: boolean, elapsedMs: number): void {
    this.latencyMs = elapsedMs;

    if (success) {
      this.consecutiveSuccesses++;
      this.consecutiveFailures = 0;

      if (this.consecutiveSuccesses >= this.successThreshold) {
        const nextState: ConnectivityState =
          elapsedMs > this.degradedLatencyThresholdMs ? 'degraded' : 'online';

        if (this.state !== nextState) {
          this.state = nextState;
          this.notify();
        }
      }
    } else {
      this.consecutiveFailures++;
      this.consecutiveSuccesses = 0;

      // Hysteresis: require 3 consecutive failures before going offline
      if (this.consecutiveFailures >= this.failureThreshold) {
        if (this.state !== 'offline') {
          this.state = 'offline';
          this.notify();
        }
      } else if (this.state === 'online') {
        // Intermittent drop -> mark as degraded
        this.state = 'degraded';
        this.notify();
      }
    }
  }

  private notify(): void {
    const q = this.getQuality();
    this.listeners.forEach((l) => {
      try {
        l(q);
      } catch {
        // Safe callback execution
      }
    });
  }

  public destroy(): void {
    if (this.probeIntervalId) {
      clearInterval(this.probeIntervalId);
      this.probeIntervalId = null;
    }
    this.listeners.clear();
  }
}

export const connectivityMonitor = new ConnectivityMonitor();
