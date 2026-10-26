// Pocket & Camera Lens Occlusion Detector
// Detects when the phone is pocketed, chest-mounted facing inward, or lens is covered
export type PocketStateChangeCallback = (isPocketed: boolean) => void;

export class PocketDetector {
  private offscreenCanvas: HTMLCanvasElement | null = null;
  private offscreenCtx: CanvasRenderingContext2D | null = null;
  private isPocketedState = false;
  private darkConsecutiveFrames = 0;
  private brightConsecutiveFrames = 0;
  private readonly thresholdFramesToEnter = 3; // ~0.5 - 1.0 second of dark frames
  private readonly thresholdFramesToExit = 2;
  private onStateChange: PocketStateChangeCallback | null = null;

  // Thresholds for dark / uniform frames (Pocket or Hand over lens)
  private readonly maxMeanLuminance = 20; // 0 - 255
  private readonly maxLuminanceVariance = 25;

  constructor(cb?: PocketStateChangeCallback) {
    if (cb) this.onStateChange = cb;
  }

  public setCallback(cb: PocketStateChangeCallback): void {
    this.onStateChange = cb;
  }

  public getIsPocketed(): boolean {
    return this.isPocketedState;
  }

  /**
   * Evaluates the current video frame luminance and uniformity.
   * Returns true if pocketed/occluded, false otherwise.
   */
  public analyzeFrame(video: HTMLVideoElement): boolean {
    if (!video || video.readyState < 2 || video.paused) {
      return this.isPocketedState;
    }

    try {
      if (!this.offscreenCanvas) {
        this.offscreenCanvas = document.createElement('canvas');
        this.offscreenCanvas.width = 16;
        this.offscreenCanvas.height = 16;
        this.offscreenCtx = this.offscreenCanvas.getContext('2d', { willReadFrequently: true });
      }

      const ctx = this.offscreenCtx;
      if (!ctx) return this.isPocketedState;

      ctx.drawImage(video, 0, 0, 16, 16);
      const imgData = ctx.getImageData(0, 0, 16, 16).data;

      let sumLuminance = 0;
      const count = 16 * 16;
      const luminances: number[] = new Array(count);

      for (let i = 0; i < imgData.length; i += 4) {
        const r = imgData[i];
        const g = imgData[i + 1];
        const b = imgData[i + 2];
        const lum = 0.299 * r + 0.587 * g + 0.114 * b;
        luminances[i / 4] = lum;
        sumLuminance += lum;
      }

      const meanLuminance = sumLuminance / count;

      let sumSquaredDiff = 0;
      for (let j = 0; j < count; j++) {
        const diff = luminances[j] - meanLuminance;
        sumSquaredDiff += diff * diff;
      }
      const variance = sumSquaredDiff / count;

      const isFrameDarkOrUniform =
        meanLuminance < this.maxMeanLuminance && variance < this.maxLuminanceVariance;

      if (isFrameDarkOrUniform) {
        this.darkConsecutiveFrames++;
        this.brightConsecutiveFrames = 0;

        if (this.darkConsecutiveFrames >= this.thresholdFramesToEnter && !this.isPocketedState) {
          this.isPocketedState = true;
          if (this.onStateChange) this.onStateChange(true);
        }
      } else {
        this.brightConsecutiveFrames++;
        this.darkConsecutiveFrames = 0;

        if (this.brightConsecutiveFrames >= this.thresholdFramesToExit && this.isPocketedState) {
          this.isPocketedState = false;
          if (this.onStateChange) this.onStateChange(false);
        }
      }

      return this.isPocketedState;
    } catch {
      return this.isPocketedState;
    }
  }

  public reset(): void {
    this.isPocketedState = false;
    this.darkConsecutiveFrames = 0;
    this.brightConsecutiveFrames = 0;
  }
}

export const pocketDetector = new PocketDetector();
