// Walk Mode Simulation & Test Harness
// Allows blind testers and developers to verify turns, off-route cues, and obstacle alerts indoors
import type { DetectedObject } from '../../types';
import { guidanceEngine } from './GuidanceEngine';
import { obstacleMonitor } from './ObstacleMonitor';
import { speechManager } from '../speechSynthesis';

export class SimulationHarness {
  private intervalId: number | null = null;
  private isSimulating = false;
  private currentTick = 0;
  private onDetectionsGenerated: ((detections: DetectedObject[]) => void) | null = null;

  // Base starting coordinate: 37.7833, -122.4167 (San Francisco Market St)
  private readonly startLat = 37.7833;
  private readonly startLng = -122.4167;

  public setDetectionsCallback(cb: (detections: DetectedObject[]) => void): void {
    this.onDetectionsGenerated = cb;
  }

  public getIsSimulating(): boolean {
    return this.isSimulating;
  }

  public async start(): Promise<void> {
    if (this.isSimulating) return;
    this.isSimulating = true;
    this.currentTick = 0;

    speechManager.speakUrgent(
      'Starting indoor walking simulation test harness. Simulating route to Central Pharmacy.'
    );

    // Initialize guidance engine with virtual route
    await guidanceEngine.startWalkMode('Central Pharmacy', {
      lat: this.startLat,
      lng: this.startLng,
    });
    // Auto-confirm after 1 second
    setTimeout(async () => {
      if (this.isSimulating) {
        await guidanceEngine.confirmDestination(0);
        this.runSimulationLoop();
      }
    }, 1500);
  }

  public stop(): void {
    this.isSimulating = false;
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
    }
    guidanceEngine.stopRoute();
    if (this.onDetectionsGenerated) {
      this.onDetectionsGenerated([]);
    }
    speechManager.speakReply('Simulation harness stopped.');
  }

  private runSimulationLoop(): void {
    this.intervalId = window.setInterval(() => {
      if (!this.isSimulating) return;
      this.currentTick++;

      const tick = this.currentTick;
      let currentLat = this.startLat;
      let currentLng = this.startLng;
      let heading = 0; // Heading North

      // Simulation Timeline:
      // Ticks 1 - 4: Walking straight North (~30 meters)
      if (tick <= 4) {
        currentLat += tick * 0.00008;
        heading = 0;
        guidanceEngine.updateHeading(heading);
        guidanceEngine.updateLocation({ lat: currentLat, lng: currentLng });
      }

      // Tick 5: Introduce obstacle ahead in walking corridor (Pole at 3 steps)
      else if (tick === 5) {
        currentLat += 5 * 0.00008;
        const fakePole: DetectedObject = {
          id: 'sim-pole',
          class: 'pole',
          score: 0.88,
          bbox: [260, 100, 120, 280], // Center corridor
          zone: 'center',
          clockDirection: "12 o'clock",
          proximityTier: 'close',
          estimatedMeters: 2.2,
          estimatedSteps: 3,
          guidanceText: 'Pole ahead',
        };
        const obstacles = obstacleMonitor.evaluateCorridor([fakePole]);
        obstacleMonitor.processEscalatingCues(obstacles, false);
        if (this.onDetectionsGenerated) this.onDetectionsGenerated([fakePole]);
      }

      // Tick 6: Obstacle approaches closer (Pole at 2 steps -> triggers vocal evasion cue)
      else if (tick === 6) {
        currentLat += 6 * 0.00008;
        const fakePoleClose: DetectedObject = {
          id: 'sim-pole',
          class: 'pole',
          score: 0.94,
          bbox: [240, 60, 160, 360],
          zone: 'center',
          clockDirection: "12 o'clock",
          proximityTier: 'danger',
          estimatedMeters: 1.4,
          estimatedSteps: 2,
          guidanceText: 'Pole ahead close',
        };
        const obstacles = obstacleMonitor.evaluateCorridor([fakePoleClose]);
        obstacleMonitor.processEscalatingCues(obstacles, false);
        if (this.onDetectionsGenerated) this.onDetectionsGenerated([fakePoleClose]);
      }

      // Ticks 7 - 9: Approach turn (approaching Pine Street, turn upcoming announcement)
      else if (tick <= 9) {
        currentLat += tick * 0.00008;
        heading = 0;
        guidanceEngine.updateHeading(heading);
        guidanceEngine.updateLocation({ lat: currentLat, lng: currentLng });
        if (this.onDetectionsGenerated) this.onDetectionsGenerated([]);
      }

      // Tick 10: Off-route deviation simulation (heading veers 35 degrees left to 325°)
      else if (tick === 10 || tick === 11) {
        currentLat += 10 * 0.00008;
        heading = 325; // Veering left!
        guidanceEngine.updateHeading(heading); // Triggers binaural right steering cue
      }

      // Tick 12: User corrects heading right towards 90° (East)
      else if (tick === 12) {
        heading = 90;
        guidanceEngine.updateHeading(heading);
      }

      // Ticks 13 - 15: Walking East along Pine St towards Central Pharmacy
      else if (tick <= 15) {
        currentLng += (tick - 12) * 0.00009;
        guidanceEngine.updateLocation({ lat: currentLat, lng: currentLng });
      }

      // Tick 16: Arrive at destination
      else if (tick >= 16) {
        const dest = guidanceEngine.getState().route?.destinationCoords;
        if (dest) {
          guidanceEngine.updateLocation(dest);
        }
        this.stop();
      }
    }, 2000);
  }
}

export const simulationHarness = new SimulationHarness();
