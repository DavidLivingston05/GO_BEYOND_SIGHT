// Haptic Vibration Patterns for Blind Walk Navigation
// Tactile Feedback for Turn-by-Turn Guidance without looking at screen
export type HapticCommand =
  | 'straight'
  | 'turnLeft'
  | 'turnRight'
  | 'arrived'
  | 'stop'
  | 'danger'
  | 'offRoute'
  | 'tapFeedback';

export const HAPTIC_PATTERNS: Record<HapticCommand, number[]> = {
  straight: [150], // One short pulse: Go straight
  turnLeft: [150, 100, 150], // Two pulses: Turn left
  turnRight: [150, 100, 150, 100, 150], // Three pulses: Turn right
  arrived: [800], // One long pulse: Arrived at destination
  stop: [800], // Long pulse: Stop
  danger: [300, 100, 300], // Urgent double buzz
  offRoute: [100, 80, 100], // Subtle double nudge
  tapFeedback: [40], // Light tactile click
};

export class HapticPatternsService {
  public isSupported(): boolean {
    return typeof navigator !== 'undefined' && 'vibrate' in navigator;
  }

  public vibrate(pattern: number[] | number): boolean {
    if (!this.isSupported()) return false;
    try {
      return navigator.vibrate(pattern);
    } catch {
      return false;
    }
  }

  public play(command: HapticCommand): boolean {
    const pattern = HAPTIC_PATTERNS[command];
    if (!pattern) return false;
    return this.vibrate(pattern);
  }

  /**
   * Explains each vibration pattern out loud with synchronous haptic demonstration
   */
  public async explainPatterns(
    speakFn: (text: string) => void
  ): Promise<void> {
    speakFn(
      'Here are the walking vibration patterns: One short pulse means go straight.'
    );
    setTimeout(() => this.play('straight'), 1200);

    setTimeout(() => {
      speakFn('Two pulses mean turn left.');
      setTimeout(() => this.play('turnLeft'), 1000);
    }, 3500);

    setTimeout(() => {
      speakFn('Three pulses mean turn right.');
      setTimeout(() => this.play('turnRight'), 1000);
    }, 7000);

    setTimeout(() => {
      speakFn('One long pulse means you have arrived or stopped.');
      setTimeout(() => this.play('arrived'), 1000);
    }, 10500);
  }
}

export const hapticService = new HapticPatternsService();
