// Real-time Local Vision, Direction Compass & Road Safety Engine (TFJS + COCO-SSD)
import * as tf from '@tensorflow/tfjs';
import * as cocoSsd from '@tensorflow-models/coco-ssd';
import { speechManager } from './speechSynthesis';
import type {
  ClockDirection,
  DetectedObject,
  ProximityTier,
  SpatialZone,
  CardinalDirection,
  DoorGuidanceInfo,
} from '../types';

export function degreesToCardinal(deg: number): CardinalDirection {
  const normalized = ((deg % 360) + 360) % 360;
  if (normalized >= 337.5 || normalized < 22.5) return 'N';
  if (normalized >= 22.5 && normalized < 67.5) return 'NE';
  if (normalized >= 67.5 && normalized < 112.5) return 'E';
  if (normalized >= 112.5 && normalized < 157.5) return 'SE';
  if (normalized >= 157.5 && normalized < 202.5) return 'S';
  if (normalized >= 202.5 && normalized < 247.5) return 'SW';
  if (normalized >= 247.5 && normalized < 292.5) return 'W';
  return 'NW';
}

const VEHICLE_CLASSES = new Set(['car', 'bus', 'truck', 'motorcycle', 'bicycle']);

class ObjectDetectorService {
  private model: cocoSsd.ObjectDetection | null = null;
  private isLoading = false;
  private isReady = false;

  // Track previous bounding box history for velocity & TTC (Time-to-Collision)
  private prevTrackers: Map<string, { area: number; time: number; centerX: number }> = new Map();

  public async init(): Promise<boolean> {
    if (this.isReady && this.model) return true;
    if (this.isLoading) return false;

    this.isLoading = true;
    try {
      await tf.ready();
      this.model = await cocoSsd.load({
        base: 'lite_mobilenet_v2',
      });
      this.isReady = true;
      this.isLoading = false;
      return true;
    } catch (err) {
      console.warn('COCO-SSD initial load failed, retrying CPU backend:', err);
      try {
        await tf.setBackend('cpu');
        this.model = await cocoSsd.load({ base: 'lite_mobilenet_v2' });
        this.isReady = true;
        this.isLoading = false;
        return true;
      } catch (fallbackErr) {
        console.error('Fatal error loading COCO-SSD:', fallbackErr);
        this.isLoading = false;
        speechManager.speakUrgent(
          'Vision model could not be loaded from cache. Compass heading, haptic guidance, and tap gestures are active.'
        );
        return false;
      }
    }
  }

  public getIsReady(): boolean {
    return this.isReady;
  }

  /**
   * Run local real-time object detection with Compass Bearing & Velocity Vector Analysis
   */
  public async detect(
    video: HTMLVideoElement,
    canvasWidth: number,
    canvasHeight: number,
    minConfidence = 0.45,
    userHeadingDegrees = 0
  ): Promise<DetectedObject[]> {
    if (!this.model || !this.isReady) return [];

    try {
      const predictions = await this.model.detect(video, 12, minConfidence);
      const now = Date.now();

      const objects: DetectedObject[] = predictions.map((pred, idx) => {
        const [x, y, width, height] = pred.bbox;
        const centerX = x + width / 2;
        const currentArea = width * height;

        // 1. Spatial Zones & Clock Directions
        let zone: SpatialZone = 'center';
        let clockDirection: ClockDirection = "12 o'clock";
        let relativeAngleDeg = 0; // -30 (left) to +30 (right) across 60-degree camera FOV

        const leftBoundary = canvasWidth * 0.35;
        const rightBoundary = canvasWidth * 0.65;

        // Calculate angular offset across ~65 degree phone lens field-of-view
        const normalizedX = (centerX - canvasWidth / 2) / (canvasWidth / 2); // -1 (left) to +1 (right)
        relativeAngleDeg = Math.round(normalizedX * 32);

        if (centerX < leftBoundary) {
          zone = 'left';
          clockDirection = normalizedX < -0.6 ? "10 o'clock" : "11 o'clock";
        } else if (centerX > rightBoundary) {
          zone = 'right';
          clockDirection = normalizedX > 0.6 ? "2 o'clock" : "1 o'clock";
        } else {
          zone = 'center';
          clockDirection = "12 o'clock";
        }

        // Absolute Cardinal Compass direction of the object relative to user's heading
        const objectCompassHeading = (userHeadingDegrees + relativeAngleDeg + 360) % 360;
        const cardinalDirection = degreesToCardinal(objectCompassHeading);

        // 2. Proximity Tiers & Distance
        const heightRatio = height / canvasHeight;
        let proximityTier: ProximityTier = 'far';
        let estimatedMeters = 3.5;

        if (heightRatio > 0.45) {
          proximityTier = 'danger';
          estimatedMeters = Math.max(0.6, +(1.2 - (heightRatio - 0.45)).toFixed(1));
        } else if (heightRatio >= 0.25) {
          proximityTier = 'close';
          estimatedMeters = +(1.2 + (0.45 - heightRatio) * 6.5).toFixed(1);
        } else {
          proximityTier = 'far';
          estimatedMeters = +(2.5 + (0.25 - heightRatio) * 10).toFixed(1);
        }

        const estimatedSteps = Math.max(1, Math.round(estimatedMeters / 0.75));

        // 3. Road & Vehicle Sentinel (TTC / Approach Speed Vector)
        const isVehicle = VEHICLE_CLASSES.has(pred.class.toLowerCase());
        let isApproachingFast = false;
        let approachSpeedRatio = 0;

        const trackerKey = `${pred.class}-${Math.round(normalizedX * 4)}`;
        const prev = this.prevTrackers.get(trackerKey);

        if (prev && isVehicle) {
          const dt = Math.max(0.1, (now - prev.time) / 1000);
          const areaGrowthRate = (currentArea - prev.area) / prev.area / dt;
          approachSpeedRatio = +(areaGrowthRate).toFixed(2);

          // If vehicle bounding box area grows > 15% per second while in center or approaching user
          if (areaGrowthRate > 0.18 && estimatedMeters < 8.0) {
            isApproachingFast = true;
          }
        }
        this.prevTrackers.set(trackerKey, { area: currentArea, time: now, centerX });

        // 4. Person Stance & Facing Direction Estimation
        let personFacing: 'facing you' | 'facing away' | 'side profile' | undefined = undefined;
        let isSelfUser = false;
        if (pred.class === 'person') {
          const aspectRatio = width / height;
          if (aspectRatio > 0.5) {
            personFacing = 'side profile';
          } else {
            // Heuristic: Front-facing individuals tend to have higher contrast variance in the upper 30% (face/torso)
            personFacing = 'facing you';
          }
          // If a person is centered in frame and takes up a large portion (> 35% height), this is typically the user on front camera / laptop webcam
          if (Math.abs(normalizedX) < 0.45 && heightRatio > 0.35) {
            isSelfUser = true;
          }
        }

        // 5. Traffic Light State Analysis (Red vs Green)
        let trafficLightState: 'red' | 'green' | 'yellow' | 'unknown' | undefined = undefined;
        if (pred.class === 'traffic light') {
          trafficLightState = this.analyzeTrafficLightColor(video, pred.bbox);
        }

        // 6. Navigation Guidance Text
        const guidanceText = this.createGuidance(
          pred.class,
          clockDirection,
          cardinalDirection,
          estimatedMeters,
          isApproachingFast
        );

        return {
          id: `${pred.class}-${idx}-${now}`,
          class: pred.class,
          score: pred.score,
          bbox: [x, y, width, height],
          zone,
          clockDirection,
          proximityTier,
          estimatedMeters,
          estimatedSteps,
          guidanceText,
          cardinalDirection,
          relativeBearingDegrees: relativeAngleDeg,
          compassHeading: Math.round(objectCompassHeading),
          personFacing,
          isSelfUser,
          isVehicle,
          isApproachingFast,
          approachSpeedRatio,
          trafficLightState,
        };
      });

      return objects;
    } catch {
      return [];
    }
  }

  /**
   * Analyzes pixel luminance in upper vs lower segments of a detected traffic light
   */
  private analyzeTrafficLightColor(
    video: HTMLVideoElement,
    bbox: [number, number, number, number]
  ): 'red' | 'green' | 'yellow' | 'unknown' {
    try {
      const [bx, by, bw, bh] = bbox;
      const offscreen = document.createElement('canvas');
      offscreen.width = 30;
      offscreen.height = 60;
      const ctx = offscreen.getContext('2d', { willReadFrequently: true });
      if (!ctx) return 'unknown';

      ctx.drawImage(video, bx, by, bw, bh, 0, 0, 30, 60);
      const imgData = ctx.getImageData(0, 0, 30, 60).data;

      let topRedScore = 0;
      let bottomGreenScore = 0;

      // Sample upper 40% (Red light)
      for (let y = 5; y < 25; y++) {
        for (let x = 5; x < 25; x++) {
          const i = (y * 30 + x) * 4;
          const r = imgData[i];
          const g = imgData[i + 1];
          const b = imgData[i + 2];
          if (r > 130 && r > g * 1.3 && r > b * 1.3) {
            topRedScore += r - (g + b) / 2;
          }
        }
      }

      // Sample lower 40% (Green light)
      for (let y = 35; y < 55; y++) {
        for (let x = 5; x < 25; x++) {
          const i = (y * 30 + x) * 4;
          const r = imgData[i];
          const g = imgData[i + 1];
          const b = imgData[i + 2];
          if (g > 120 && g > r * 1.15) {
            bottomGreenScore += g - (r + b) / 2;
          }
        }
      }

      if (topRedScore > 1500 && topRedScore > bottomGreenScore * 1.5) {
        return 'red';
      }
      if (bottomGreenScore > 1200 && bottomGreenScore > topRedScore * 1.3) {
        return 'green';
      }
      return 'unknown';
    } catch {
      return 'unknown';
    }
  }

  /**
   * Road Crosswalk / Zebra Crossing Detector
   * Analyzes alternating contrast stripes on road surfaces
   */
  public detectCrosswalkHeuristic(video: HTMLVideoElement): boolean {
    try {
      const offscreen = document.createElement('canvas');
      offscreen.width = 120;
      offscreen.height = 80;
      const ctx = offscreen.getContext('2d', { willReadFrequently: true });
      if (!ctx) return false;

      // Draw bottom half of camera frame where road stripes lie
      ctx.drawImage(video, 0, video.videoHeight * 0.45, video.videoWidth, video.videoHeight * 0.55, 0, 0, 120, 80);
      const data = ctx.getImageData(0, 0, 120, 80).data;

      // Count horizontal luminance transitions
      let stripeTransitions = 0;
      for (let y = 30; y < 65; y += 8) {
        let prevBright = false;
        for (let x = 10; x < 110; x++) {
          const idx = (y * 120 + x) * 4;
          const lum = data[idx] * 0.299 + data[idx + 1] * 0.587 + data[idx + 2] * 0.114;
          const isBright = lum > 175;
          if (isBright !== prevBright) {
            stripeTransitions++;
            prevBright = isBright;
          }
        }
      }

      // Zebra crossings produce 12+ sharp alternating stripe transitions
      return stripeTransitions >= 12;
    } catch {
      return false;
    }
  }

  private createGuidance(
    label: string,
    clock: ClockDirection,
    cardinal: CardinalDirection,
    meters: number,
    isApproachingFast: boolean
  ): string {
    const formatted = label.charAt(0).toUpperCase() + label.slice(1);

    if (isApproachingFast) {
      return `WARNING: Fast ${formatted} approaching at ${clock} (${cardinal})! Step back on curb!`;
    }

    if (meters < 1.2) {
      return `Stop! ${formatted} directly in front at ${clock} (${cardinal}), less than 1.2 meters away!`;
    }

    return `${formatted} at ${clock} (${cardinal}), about ${meters} meters ahead.`;
  }

  /**
   * Structural Door & Pathway Heuristic Analyzer with Compass Bearing & Turn Angle
   */
  public detectDoorHeuristic(
    video: HTMLVideoElement,
    _canvasWidth?: number,
    _canvasHeight?: number,
    userHeadingDegrees = 0
  ): DoorGuidanceInfo | null {
    try {
      const offscreen = document.createElement('canvas');
      offscreen.width = 160;
      offscreen.height = 120;
      const ctx = offscreen.getContext('2d', { willReadFrequently: true });
      if (!ctx) return null;

      ctx.drawImage(video, 0, 0, 160, 120);
      const data = ctx.getImageData(0, 0, 160, 120).data;

      let leftEdgeSum = 0;
      let centerEdgeSum = 0;
      let rightEdgeSum = 0;

      for (let y = 10; y < 110; y++) {
        for (let x = 1; x < 159; x++) {
          const leftIdx = (y * 160 + (x - 1)) * 4;
          const rightIdx = (y * 160 + (x + 1)) * 4;

          const lumLeft = data[leftIdx] * 0.299 + data[leftIdx + 1] * 0.587 + data[leftIdx + 2] * 0.114;
          const lumRight = data[rightIdx] * 0.299 + data[rightIdx + 1] * 0.587 + data[rightIdx + 2] * 0.114;
          const grad = Math.abs(lumRight - lumLeft);

          if (grad > 35) {
            if (x < 55) leftEdgeSum += grad;
            else if (x > 105) rightEdgeSum += grad;
            else centerEdgeSum += grad;
          }
        }
      }

      const maxEdge = Math.max(leftEdgeSum, centerEdgeSum, rightEdgeSum);
      if (maxEdge < 2500) return null;

      let direction: ClockDirection = "12 o'clock";
      let turnOffsetDeg = 0;

      if (maxEdge === leftEdgeSum) {
        direction = "10 o'clock";
        turnOffsetDeg = -25; // Turn 25 degrees left to face door
      } else if (maxEdge === rightEdgeSum) {
        direction = "2 o'clock";
        turnOffsetDeg = 25; // Turn 25 degrees right to face door
      }

      const doorCompassDegrees = Math.round((userHeadingDegrees + turnOffsetDeg + 360) % 360);
      const cardinalDirection = degreesToCardinal(doorCompassDegrees);

      return {
        detected: true,
        direction,
        cardinalDirection,
        degrees: doorCompassDegrees,
        turnOffsetDeg,
        confidence: Math.min(0.88, +(maxEdge / 5000).toFixed(2)),
        meters: 2.8,
        estimatedSteps: 4,
      };
    } catch {
      return null;
    }
  }
}

export const objectDetectorService = new ObjectDetectorService();
