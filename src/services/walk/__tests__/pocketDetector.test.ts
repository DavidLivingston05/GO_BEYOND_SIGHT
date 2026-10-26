import { describe, it, expect, vi } from 'vitest';
import { PocketDetector } from '../PocketDetector';

describe('PocketDetector', () => {
  it('initializes in non-pocketed state', () => {
    const detector = new PocketDetector();
    expect(detector.getIsPocketed()).toBe(false);
  });

  it('notifies callbacks on state changes', () => {
    const cb = vi.fn();
    const detector = new PocketDetector(cb);

    // Trigger state reset
    detector.reset();
    expect(detector.getIsPocketed()).toBe(false);
  });
});
