import { describe, it, expect } from 'vitest';
import { ObstacleMonitor } from '../ObstacleMonitor';
import type { DetectedObject } from '../../../types';

describe('ObstacleMonitor Corridor & Escalating Cues', () => {
  const monitor = new ObstacleMonitor();

  it('filters obstacles in walking corridor (center 40% of frame)', () => {
    const videoWidth = 640;
    const videoHeight = 480;

    const leftObstacle: DetectedObject = {
      id: '1',
      class: 'bench',
      score: 0.9,
      bbox: [50, 100, 100, 150], // Center is at x = 100 (< 192), outside corridor
      zone: 'left',
      clockDirection: "10 o'clock",
      proximityTier: 'close',
      estimatedMeters: 2.0,
      estimatedSteps: 3,
      guidanceText: '',
    };

    const centerObstacle: DetectedObject = {
      id: '2',
      class: 'fire hydrant',
      score: 0.85,
      bbox: [280, 100, 80, 150], // Center is at x = 320 (in central 40%), inside corridor
      zone: 'center',
      clockDirection: "12 o'clock",
      proximityTier: 'close',
      estimatedMeters: 1.5,
      estimatedSteps: 2,
      guidanceText: '',
    };

    const rightObstacle: DetectedObject = {
      id: '3',
      class: 'car',
      score: 0.92,
      bbox: [520, 100, 100, 150], // Center is at x = 570 (> 448), outside corridor
      zone: 'right',
      clockDirection: "2 o'clock",
      proximityTier: 'close',
      estimatedMeters: 2.0,
      estimatedSteps: 3,
      guidanceText: '',
    };

    const results = monitor.evaluateCorridor([leftObstacle, centerObstacle, rightObstacle], videoWidth, videoHeight);

    expect(results.length).toBe(1);
    expect(results[0].detected.class).toBe('fire hydrant');
    expect(results[0].stepsAway).toBe(2);
  });

  it('determines evasion side based on obstacle position relative to center', () => {
    const videoWidth = 640;
    const slightlyRightObstacle: DetectedObject = {
      id: '4',
      class: 'pole',
      score: 0.9,
      bbox: [350, 100, 60, 200], // Center is 380 (> 320)
      zone: 'center',
      clockDirection: "12 o'clock",
      proximityTier: 'close',
      estimatedMeters: 2.0,
      estimatedSteps: 3,
      guidanceText: '',
    };

    const results = monitor.evaluateCorridor([slightlyRightObstacle], videoWidth);
    expect(results[0].evasionSide).toBe('left');
  });
});
