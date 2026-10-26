import { describe, it, expect, beforeEach } from 'vitest';
import { FeatureGate } from '../FeatureGate';
import { connectivityMonitor } from '../ConnectivityMonitor';

describe('FeatureGate Decision Logic', () => {
  const gate = new FeatureGate();

  beforeEach(() => {
    connectivityMonitor.setSimulationOverride(null);
  });

  it('keeps path clearance, vehicle sentinel, and doors at edge regardless of network', () => {
    connectivityMonitor.setSimulationOverride('online');
    expect(gate.evaluate('check_path')).toBe('edge');
    expect(gate.evaluate('vehicle_sentinel')).toBe('edge');
    expect(gate.evaluate('find_door')).toBe('edge');

    connectivityMonitor.setSimulationOverride('offline');
    expect(gate.evaluate('check_path')).toBe('edge');
    expect(gate.evaluate('vehicle_sentinel')).toBe('edge');
    expect(gate.evaluate('find_door')).toBe('edge');
  });

  it('routes room description to edge when offline and cloud when online', () => {
    connectivityMonitor.setSimulationOverride('online');
    expect(gate.evaluate('describe_room')).toBe('cloud');

    connectivityMonitor.setSimulationOverride('offline');
    expect(gate.evaluate('describe_room')).toBe('edge');

    connectivityMonitor.setSimulationOverride('degraded');
    expect(gate.evaluate('describe_room')).toBe('edge');
  });

  it('marks cloud-only operations as unavailable when offline', () => {
    connectivityMonitor.setSimulationOverride('offline');
    expect(gate.evaluate('read_text')).toBe('unavailable');
    expect(gate.evaluate('route_navigation')).toBe('unavailable');

    connectivityMonitor.setSimulationOverride('online');
    expect(gate.evaluate('read_text')).toBe('cloud');
    expect(gate.evaluate('route_navigation')).toBe('cloud');
  });
});
