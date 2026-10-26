import { describe, it, expect, vi } from 'vitest';
import { HapticPatternsService, HAPTIC_PATTERNS } from '../HapticPatterns';

describe('HapticPatternsService', () => {
  it('defines correct vibration patterns for navigation', () => {
    // 1 short pulse = go straight
    expect(HAPTIC_PATTERNS.straight).toEqual([150]);
    // 2 pulses = turn left
    expect(HAPTIC_PATTERNS.turnLeft).toEqual([150, 100, 150]);
    // 3 pulses = turn right
    expect(HAPTIC_PATTERNS.turnRight).toEqual([150, 100, 150, 100, 150]);
    // Long pulse = arrived/stop
    expect(HAPTIC_PATTERNS.arrived).toEqual([800]);
    expect(HAPTIC_PATTERNS.stop).toEqual([800]);
  });

  it('handles vibration triggering gracefully when API is mocked', () => {
    const service = new HapticPatternsService();
    const mockVibrate = vi.fn().mockReturnValue(true);

    vi.spyOn(service, 'isSupported').mockReturnValue(true);
    vi.spyOn(service, 'vibrate').mockImplementation((pattern) => {
      mockVibrate(pattern);
      return true;
    });

    expect(service.isSupported()).toBe(true);
    expect(service.play('straight')).toBe(true);
    expect(mockVibrate).toHaveBeenCalledWith([150]);
  });
});
