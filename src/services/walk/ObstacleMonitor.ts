// Obstacle Monitor for Walk Mode
// Walking corridor filtering (center ~40%), 3-stage escalating audio cues & debounced speech
import type { DetectedObject } from '../../types';
import { audioEngine } from '../audioEngine';
import { speechManager } from '../speechSynthesis';
import { i18n } from '../i18n';
import { hapticService } from './HapticPatterns';

export interface CorridorObstacle {
  detected: DetectedObject;
  corridorXRatio: number; // 0 (left of corridor) to 1 (right of corridor)
  panValue: number; // -1 to +1
  stepsAway: number;
  evasionSide: 'left' | 'right';
}

export class ObstacleMonitor {
  // Track previously announced obstacles to maintain hysteresis and prevent chatter loops
  private trackerMap: Map<string, { lastSteps: number; lastAnnounceTime: number; stage: number }> =
    new Map();

  private lastGeminiHazardCheckTime = 0;
  private readonly geminiCooldownMs = 12000; // 12s cooldown to protect rate limits and battery

  /**
   * Filters and analyzes detections within the walking corridor (center ~40% of frame)
   */
  public evaluateCorridor(
    detections: DetectedObject[],
    videoWidth = 640,
    _videoHeight = 480
  ): CorridorObstacle[] {
    const corridorLeft = videoWidth * 0.3;
    const corridorRight = videoWidth * 0.7;

    const obstacles: CorridorObstacle[] = [];

    for (const d of detections) {
      if (d.isSelfUser) continue;

      const [x, , width] = d.bbox;
      const centerX = x + width / 2;

      // Check if center of object lies in central 40% walking corridor
      if (centerX >= corridorLeft && centerX <= corridorRight) {
        // Steps calculation (estimatedMeters / 0.75)
        const stepsAway = Math.max(1, Math.round(d.estimatedMeters / 0.75));

        // Pan value across total video width (-1 full left to +1 full right)
        const panValue = (centerX - videoWidth / 2) / (videoWidth / 2);

        // Normalized corridor ratio: 0 (left edge of corridor) to 1 (right edge)
        const corridorXRatio = (centerX - corridorLeft) / (corridorRight - corridorLeft);

        // Evasion suggestion: if obstacle is slightly right of center, move left; else move right
        const evasionSide: 'left' | 'right' = centerX > videoWidth * 0.5 ? 'left' : 'right';

        // Corridor interest is for obstacles within ~3.5 steps (~2.6 meters) or approaching fast
        if (stepsAway <= 4 || d.isApproachingFast) {
          obstacles.push({
            detected: d,
            corridorXRatio,
            panValue,
            stepsAway,
            evasionSide,
          });
        }
      }
    }

    // Sort closest first
    obstacles.sort((a, b) => a.stepsAway - b.stepsAway);
    return obstacles;
  }

  /**
   * Processes corridor obstacles through the escalating cue system:
   * Stage 1: Soft ping (at ~3-4 steps)
   * Stage 2: Faster ping with stereo panning to obstacle side (< 3 steps)
   * Stage 3: Brief spoken warning (< 2 steps)
   */
  public processEscalatingCues(
    obstacles: CorridorObstacle[],
    isPocketed: boolean
  ): void {
    if (isPocketed || obstacles.length === 0) return;

    const now = Date.now();
    const primary = obstacles[0];
    const item = primary.detected;
    const trackerKey = `${item.class}-${item.zone}`;
    const prev = this.trackerMap.get(trackerKey);

    const steps = primary.stepsAway;
    const evasionSide = primary.evasionSide;
    const t = i18n.t;
    const localizedSide = evasionSide === 'left' ? t.moveLeft : t.moveRight;
    const unitLabel = t.stepsLabel;

    // 1. High-priority hazards: Vehicles & Bicycles
    const isPriorityHazard =
      item.isVehicle || item.class === 'bicycle' || item.isApproachingFast;

    if (isPriorityHazard) {
      if (!prev || now - prev.lastAnnounceTime > 3000) {
        this.trackerMap.set(trackerKey, { lastSteps: steps, lastAnnounceTime: now, stage: 3 });
        audioEngine.playApproachingVehicleSiren(item.zone);
        hapticService.play('danger');
        speechManager.speakUrgent(t.vehicleWarning(item.class, item.clockDirection));
      }
      return;
    }

    // 2. Escalating Obstacle Cues within corridor:
    // Stage 1: Distance ~3-4 steps (soft ping)
    if (steps > 2 && steps <= 4) {
      if (!prev || now - prev.lastAnnounceTime > 1600) {
        audioEngine.playObstacleEscalatingPing(primary.panValue, 1);
        this.trackerMap.set(trackerKey, { lastSteps: steps, lastAnnounceTime: now, stage: 1 });
      }
      return;
    }

    // Stage 2: Distance 2 steps (faster stereo panned ping)
    if (steps === 2) {
      if (!prev || prev.stage < 2 || now - prev.lastAnnounceTime > 1200) {
        audioEngine.playObstacleEscalatingPing(primary.panValue, 2);
        hapticService.play('offRoute');
        this.trackerMap.set(trackerKey, { lastSteps: steps, lastAnnounceTime: now, stage: 2 });
      }
      return;
    }

    // Stage 3: Distance <= 2 steps (Spoken warning with hysteresis: announce once, then only if distance changes by > 1 step)
    if (steps <= 2) {
      const distanceChangedByMoreThanOneStep = prev ? Math.abs(prev.lastSteps - steps) >= 1.5 : true;
      const cooldownPassed = prev ? now - prev.lastAnnounceTime > 4500 : true;

      if (!prev || (distanceChangedByMoreThanOneStep && cooldownPassed)) {
        this.trackerMap.set(trackerKey, { lastSteps: steps, lastAnnounceTime: now, stage: 3 });
        audioEngine.playObstacleEscalatingPing(primary.panValue, 2);
        hapticService.play('danger');
        speechManager.speakUrgent(
          t.obstacleAhead(item.class, steps, unitLabel, localizedSide)
        );
      }
    }
  }

  /**
   * Resets obstacle tracking map when route ends
   */
  public reset(): void {
    this.trackerMap.clear();
  }

  public canTriggerGeminiHazardSnapshot(): boolean {
    const now = Date.now();
    if (now - this.lastGeminiHazardCheckTime > this.geminiCooldownMs) {
      this.lastGeminiHazardCheckTime = now;
      return true;
    }
    return false;
  }
}

export const obstacleMonitor = new ObstacleMonitor();
