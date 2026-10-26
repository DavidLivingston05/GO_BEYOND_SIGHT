import { describe, it, expect } from 'vitest';
import { ConnectivityMonitor } from '../ConnectivityMonitor';

describe('ConnectivityMonitor Hysteresis', () => {
  it('initializes with online state', () => {
    const monitor = new ConnectivityMonitor();
    expect(monitor.isOnline()).toBe(true);
    monitor.destroy();
  });

  it('respects simulation override', () => {
    const monitor = new ConnectivityMonitor();
    monitor.setSimulationOverride('offline');
    expect(monitor.isOnline()).toBe(false);
    expect(monitor.getQuality().state).toBe('offline');

    monitor.setSimulationOverride('degraded');
    expect(monitor.isOnline()).toBe(true);
    expect(monitor.isDegraded()).toBe(true);

    monitor.setSimulationOverride(null);
    monitor.destroy();
  });

  it('requires multiple failures before declaring offline', () => {
    const monitor = new ConnectivityMonitor();
    // Simulate single failure via probe handler
    (monitor as any).handleProbeResult(false, 100);
    expect(monitor.isOnline()).toBe(true); // Should not immediately flip offline on 1st fail

    (monitor as any).handleProbeResult(false, 100);
    expect(monitor.isOnline()).toBe(true); // Still not offline on 2nd fail

    (monitor as any).handleProbeResult(false, 100);
    expect(monitor.getQuality().state).toBe('offline'); // Flips to offline on 3rd consecutive fail
    monitor.destroy();
  });
});
