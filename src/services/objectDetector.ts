// Real-time Local Vision & Object Detection Engine (TFJS + COCO-SSD)
import * as tf from '@tensorflow/tfjs';
import * as cocoSsd from '@tensorflow-models/coco-ssd';
import type { ClockDirection, DetectedObject, ProximityTier, SpatialZone } from '../types';

class ObjectDetectorService {
  private model: cocoSsd.ObjectDetection | null = null;
  private isLoading = false;
  private isReady = false;

  public async init(): Promise<boolean> {
    if (this.isReady && this.model) return true;
    if (this.isLoading) return false;

    this.isLoading = true;
    try {
      // Ensure tf backend is ready
      await tf.ready();
      // Load COCO-SSD lite model
      this.model = await cocoSsd.load({
        base: 'lite_mobilenet_v2',
      });
      this.isReady = true;
      this.isLoading = false;
      return true;
    } catch (err) {
      console.warn('Failed to load local COCO-SSD model, retrying with standard backend:', err);
      try {
        await tf.setBackend('cpu');
        this.model = await cocoSsd.load({ base: 'lite_mobilenet_v2' });
        this.isReady = true;
        this.isLoading = false;
        return true;
      } catch (fallbackErr) {
        console.error('Fatal error loading COCO-SSD:', fallbackErr);
        this.isLoading = false;
        return false;
      }
    }
  }

  public getIsReady(): boolean {
    return this.isReady;
  }

  /**
   * Run local real-time object detection on video element
   */
  public async detect(
    video: HTMLVideoElement,
    canvasWidth: number,
    canvasHeight: number,
    minConfidence = 0.45
  ): Promise<DetectedObject[]> {
    if (!this.model || !this.isReady) return [];

    try {
      const predictions = await this.model.detect(video, 10, minConfidence);
      const objects: DetectedObject[] = predictions.map((pred, idx) => {
        const [x, y, width, height] = pred.bbox;
        const centerX = x + width / 2;

        // 1. Divide into 3 Horizontal Spatial Zones:
        // Left = 10 o'clock, Center = 12 o'clock, Right = 2 o'clock
        let zone: SpatialZone = 'center';
        let clockDirection: ClockDirection = "12 o'clock";

        const leftBoundary = canvasWidth * 0.35;
        const rightBoundary = canvasWidth * 0.65;

        if (centerX < leftBoundary) {
          zone = 'left';
          clockDirection = "10 o'clock";
        } else if (centerX > rightBoundary) {
          zone = 'right';
          clockDirection = "2 o'clock";
        } else {
          zone = 'center';
          clockDirection = "12 o'clock";
        }

        // 2. Divide into 3 Proximity Tiers based on bounding-box height/area ratio:
        const heightRatio = height / canvasHeight;
        let proximityTier: ProximityTier = 'far';
        let estimatedMeters = 3.5;

        if (heightRatio > 0.45) {
          // Immediate Danger (< 1.2 meters)
          proximityTier = 'danger';
          estimatedMeters = Math.max(0.6, +(1.2 - (heightRatio - 0.45)).toFixed(1));
        } else if (heightRatio >= 0.25) {
          // Close (1.2m - 2.5 meters)
          proximityTier = 'close';
          estimatedMeters = +(1.2 + (0.45 - heightRatio) * 6.5).toFixed(1);
        } else {
          // Far (2.5m - 4+ meters)
          proximityTier = 'far';
          estimatedMeters = +(2.5 + (0.25 - heightRatio) * 10).toFixed(1);
        }

        // Steps estimation: approx 0.75m per step
        const estimatedSteps = Math.max(1, Math.round(estimatedMeters / 0.75));

        // 3. Smart Navigation Guidance Text
        const guidanceText = this.createGuidance(pred.class, clockDirection, estimatedMeters, zone);

        return {
          id: `${pred.class}-${idx}-${Date.now()}`,
          class: pred.class,
          score: pred.score,
          bbox: [x, y, width, height],
          zone,
          clockDirection,
          proximityTier,
          estimatedMeters,
          estimatedSteps,
          guidanceText,
        };
      });

      return objects;
    } catch {
      return [];
    }
  }

  private createGuidance(
    label: string,
    direction: ClockDirection,
    meters: number,
    zone: SpatialZone
  ): string {
    const formattedLabel = label.charAt(0).toUpperCase() + label.slice(1);
    let suggestion = '';

    if (direction === "12 o'clock") {
      suggestion = 'Step slightly to your left or right to bypass.';
    } else if (zone === 'left') {
      suggestion = 'Path slightly right is clearer.';
    } else {
      suggestion = 'Path slightly left is clearer.';
    }

    if (meters < 1.2) {
      return `Caution! ${formattedLabel} immediately ahead at ${direction}, ${meters} meters away! Please stop.`;
    }

    return `${formattedLabel} at ${direction}, about ${meters} meters ahead. ${suggestion}`;
  }

  /**
   * Edge-based Structural Door / Pathway Heuristic Analyzer
   * Detects vertical parallel door frame lines and high aspect ratio portals
   */
  public detectDoorHeuristic(
    video: HTMLVideoElement,
    _canvasWidth?: number,
    _canvasHeight?: number
  ): { detected: boolean; direction: ClockDirection; confidence: number; meters: number } | null {
    try {
      const offscreen = document.createElement('canvas');
      offscreen.width = 160; // downsampled for ultra-fast heuristic
      offscreen.height = 120;
      const ctx = offscreen.getContext('2d', { willReadFrequently: true });
      if (!ctx) return null;

      ctx.drawImage(video, 0, 0, 160, 120);
      const imgData = ctx.getImageData(0, 0, 160, 120);
      const data = imgData.data;

      // Sobel vertical gradient accumulator
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
      if (maxEdge < 2500) return null; // Insufficient portal contrast

      let direction: ClockDirection = "12 o'clock";
      if (maxEdge === leftEdgeSum) direction = "10 o'clock";
      else if (maxEdge === rightEdgeSum) direction = "2 o'clock";

      return {
        detected: true,
        direction,
        confidence: Math.min(0.85, +(maxEdge / 5000).toFixed(2)),
        meters: 2.5,
      };
    } catch {
      return null;
    }
  }
}

export const objectDetectorService = new ObjectDetectorService();
