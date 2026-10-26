// Smart Walk Guidance Engine
// Egocentric, minimal turn-by-turn guidance, off-route binaural steering & arrival management
import type {
  ClockDirection,
  LatLng,
  WalkGuidanceState,
} from '../../types';
import {
  calculateBearing,
  calculateHaversineDistance,
  defaultRouteProvider,
  type IRouteProvider,
} from './RouteProvider';
import { audioEngine } from '../audioEngine';
import { speechManager } from '../speechSynthesis';
import { i18n } from '../i18n';
import { hapticService } from './HapticPatterns';

const DISCLAIMER_ACK_KEY = 'beyond_sight_disclaimer_ack';

export type GuidanceStateListener = (state: WalkGuidanceState) => void;

/**
 * Calculates clock-face direction (e.g. 12 o'clock, 1 o'clock, 11 o'clock)
 * given relative bearing offset (-180 to +180 deg).
 */
export function degreesToClockDirection(relativeDeg: number): ClockDirection {
  const norm = (relativeDeg + 360) % 360;
  if (norm >= 345 || norm < 15) return "12 o'clock";
  if (norm >= 15 && norm < 45) return "1 o'clock";
  if (norm >= 45 && norm < 75) return "2 o'clock";
  if (norm >= 75 && norm < 105) return "3 o'clock";
  if (norm >= 255 && norm < 285) return "9 o'clock";
  if (norm >= 285 && norm < 315) return "10 o'clock";
  if (norm >= 315 && norm < 345) return "11 o'clock";
  return norm < 180 ? "2 o'clock" : "10 o'clock";
}

/**
 * Calculates perpendicular distance (cross-track distance) from a point to a line segment in meters
 */
export function calculateCrossTrackDistance(point: LatLng, start: LatLng, end: LatLng): number {
  const distToStart = calculateHaversineDistance(point, start);
  if (distToStart < 2) return 0;
  const bearingStartPoint = calculateBearing(start, point);
  const bearingStartEnd = calculateBearing(start, end);
  const angleDiff = ((bearingStartPoint - bearingStartEnd + 540) % 360) - 180;
  return Math.abs(Math.sin((angleDiff * Math.PI) / 180) * distToStart);
}

export class GuidanceEngine {
  private routeProvider: IRouteProvider = defaultRouteProvider;
  private state: WalkGuidanceState = {
    status: 'idle',
    route: null,
    currentStepIndex: 0,
    distanceToNextTurnMeters: 0,
    stepsToNextTurn: 0,
    clockDirection: "12 o'clock",
    isOffRoute: false,
    offRouteDeviationDeg: 0,
    isPocketed: false,
    gpsAccuracyMeters: 5,
  };

  private userLocation: LatLng | null = null;
  private userHeading = 0;
  private announcedUpcomingTurn = false;
  private announcedTurnNow = false;
  private offRouteStartTime = 0;
  private lastBinauralCueTime = 0;
  private lastGpsWarningTime = 0;
  private stateListeners: Set<GuidanceStateListener> = new Set();

  constructor(provider?: IRouteProvider) {
    if (provider) this.routeProvider = provider;
  }

  public setRouteProvider(provider: IRouteProvider): void {
    this.routeProvider = provider;
  }

  public getState(): WalkGuidanceState {
    return { ...this.state };
  }

  public subscribe(listener: GuidanceStateListener): () => void {
    this.stateListeners.add(listener);
    listener(this.getState());
    return () => this.stateListeners.delete(listener);
  }

  private notify(): void {
    const s = this.getState();
    this.stateListeners.forEach((l) => l(s));
  }

  /**
   * First use disclaimer check (speaks once, stored in localStorage)
   */
  public checkAndSpeakDisclaimer(): boolean {
    if (typeof window === 'undefined') return false;
    try {
      const ack = localStorage.getItem(DISCLAIMER_ACK_KEY);
      if (!ack) {
        localStorage.setItem(DISCLAIMER_ACK_KEY, 'true');
        speechManager.speakUrgent(i18n.t.disclaimer);
        return true;
      }
    } catch {
      // Ignore
    }
    return false;
  }

  /**
   * Initiates Walk Mode.
   * If a destination query is provided, geocodes and presents confirmation.
   * If not, asks "Where would you like to walk to?"
   */
  public async startWalkMode(destinationQuery?: string, initialLoc?: LatLng): Promise<void> {
    this.checkAndSpeakDisclaimer();
    if (initialLoc) this.userLocation = initialLoc;

    if (!destinationQuery || destinationQuery.trim().length === 0) {
      this.state.status = 'idle';
      this.notify();
      speechManager.speakReply(i18n.t.askingDestination);
      return;
    }

    await this.searchAndOfferDestinations(destinationQuery);
  }

  /**
   * Geocodes the destination query and offers up to 3 choices
   */
  public async searchAndOfferDestinations(query: string): Promise<void> {
    this.state.status = 'confirming_destination';
    this.state.pendingDestinationQuery = query;
    this.notify();

    try {
      const results = await this.routeProvider.geocode(query, this.userLocation || undefined);

      if (results.length === 0) {
        speechManager.speakReply(`Could not find "${query}". Please say the destination again.`);
        this.state.status = 'idle';
        this.notify();
        return;
      }

      this.state.destinationChoices = results;

      if (results.length === 1) {
        const place = results[0];
        speechManager.speakReply(i18n.t.confirmDestination(place.name));
      } else {
        // Offer up to 3 choices
        const choicesList = results
          .slice(0, 3)
          .map((r, i) => `${i + 1}. ${r.name}`)
          .join(', ');
        speechManager.speakReply(i18n.t.multipleChoices(results.length, choicesList));
      }
      this.notify();
    } catch (err) {
      console.warn('Geocoding error:', err);
      speechManager.speakReply('Could not locate destination. Please check your internet connection.');
      this.state.status = 'idle';
      this.notify();
    }
  }

  /**
   * User confirms destination choice ("yes" or "1", "2", "3")
   */
  public async confirmDestination(choiceIndex = 0): Promise<void> {
    const choices = this.state.destinationChoices;
    if (!choices || choices.length === 0) {
      speechManager.speakReply('No destination was pending. Where would you like to walk to?');
      return;
    }

    const selected = choices[choiceIndex] || choices[0];
    const startLoc = this.userLocation || { lat: selected.lat - 0.003, lng: selected.lng - 0.003 };

    try {
      audioEngine.playThinkingChime();
      const route = await this.routeProvider.getRoute(
        startLoc,
        { lat: selected.lat, lng: selected.lng },
        selected.name
      );

      this.state.route = route;
      this.state.status = 'walking';
      this.state.currentStepIndex = 0;
      this.state.destinationChoices = undefined;
      this.state.pendingDestinationQuery = undefined;
      this.announcedUpcomingTurn = false;
      this.announcedTurnNow = false;

      const firstStep = route.steps[0];
      const initialDist = firstStep ? firstStep.distanceMeters : route.totalDistanceMeters;
      const fmt = i18n.formatDistance(initialDist);

      audioEngine.playSuccessTone();
      hapticService.play('straight');

      speechManager.speakUrgent(
        i18n.t.routeStarting(route.destinationName, fmt.value, fmt.label)
      );
      this.notify();
    } catch (err) {
      console.error('Failed to get route:', err);
      speechManager.speakReply('Could not calculate walking path. Please try again.');
      this.state.status = 'idle';
      this.notify();
    }
  }

  public cancelDestination(): void {
    this.state.status = 'idle';
    this.state.destinationChoices = undefined;
    this.state.pendingDestinationQuery = undefined;
    speechManager.speakReply('Destination cancelled.');
    this.notify();
  }

  /**
   * Stop walking route at any time
   */
  public stopRoute(): void {
    this.state.status = 'idle';
    this.state.route = null;
    this.state.currentStepIndex = 0;
    this.state.isOffRoute = false;
    this.announcedUpcomingTurn = false;
    this.announcedTurnNow = false;
    audioEngine.playDeactivationChime();
    hapticService.play('stop');
    speechManager.speakReply(i18n.t.routeStopped);
    this.notify();
  }

  /**
   * Update Pocketed status
   */
  public setPocketed(pocketed: boolean): void {
    if (this.state.isPocketed !== pocketed) {
      this.state.isPocketed = pocketed;
      if (pocketed) {
        speechManager.speakUrgent(i18n.t.cameraNotVisible);
      } else {
        speechManager.speakUrgent(i18n.t.cameraVisible);
      }
      this.notify();
    }
  }

  /**
   * Updates user compass heading and monitors path alignment
   */
  public updateHeading(headingDeg: number): void {
    this.userHeading = headingDeg;

    if (this.state.status !== 'walking' || !this.state.route) return;
    this.checkHeadingDeviation();
  }

  /**
   * Processes live GPS location update
   */
  public updateLocation(loc: LatLng, accuracyMeters = 5): void {
    this.userLocation = loc;
    this.state.gpsAccuracyMeters = accuracyMeters;

    // GPS accuracy check: if > 30m, warn once
    const now = Date.now();
    if (accuracyMeters > 30 && now - this.lastGpsWarningTime > 30000) {
      this.lastGpsWarningTime = now;
      speechManager.speakUrgent(i18n.t.gpsAccuracyLow(Math.round(accuracyMeters)));
    }

    if (this.state.status !== 'walking' || !this.state.route) {
      this.notify();
      return;
    }

    this.evaluateRouteProgress(loc);
  }

  /**
   * Core turn timing, off-route calculation, and arrival logic
   */
  private evaluateRouteProgress(loc: LatLng): void {
    const route = this.state.route;
    if (!route) return;

    // 1. Arrival Check: within 10 meters of destination
    const distToDestination = calculateHaversineDistance(loc, route.destinationCoords);
    if (distToDestination <= 10) {
      this.state.status = 'arrived';
      audioEngine.playSuccessTone();
      hapticService.play('arrived');
      speechManager.speakUrgent(i18n.t.arrived(route.destinationName));
      this.notify();
      return;
    }

    // 2. Step progress
    const steps = route.steps;
    let stepIndex = this.state.currentStepIndex;
    let currentStep = steps[stepIndex] || steps[steps.length - 1];

    // Find target maneuver location for current step
    const targetLoc = currentStep.maneuver.location || route.destinationCoords;
    let distToTurn = calculateHaversineDistance(loc, targetLoc);

    // If passed current maneuver or very close to it (< 8m), advance to next step
    if (distToTurn < 8 && stepIndex < steps.length - 1) {
      stepIndex++;
      this.state.currentStepIndex = stepIndex;
      currentStep = steps[stepIndex];
      this.announcedUpcomingTurn = false;
      this.announcedTurnNow = false;
      distToTurn = calculateHaversineDistance(loc, currentStep.maneuver.location);
    }

    this.state.distanceToNextTurnMeters = distToTurn;
    this.state.stepsToNextTurn = Math.max(1, Math.round(distToTurn / 0.75));
    this.state.nextManeuverModifier = currentStep.maneuver.modifier;
    this.state.nextStreetName = currentStep.name;

    // Clock direction of next turn waypoint relative to user heading
    const bearingToWaypoint = calculateBearing(loc, targetLoc);
    const relativeAngle = ((bearingToWaypoint - this.userHeading + 540) % 360) - 180;
    this.state.clockDirection = degreesToClockDirection(relativeAngle);

    // 3. Minimum Announcement State Machine
    const t = i18n.t;
    const modifier = currentStep.maneuver.modifier || 'straight';
    const street = currentStep.name;
    const localizedTurn = this.localizeTurnModifier(modifier);

    // Turn Now Announcement (< 10 meters)
    if (distToTurn <= 10 && !this.announcedTurnNow && modifier !== 'straight') {
      this.announcedTurnNow = true;
      if (modifier.includes('left')) hapticService.play('turnLeft');
      else if (modifier.includes('right')) hapticService.play('turnRight');

      speechManager.speakUrgent(t.turnNow(localizedTurn, street));
    }
    // 30 meters before turn (~40 steps)
    else if (distToTurn <= 30 && distToTurn > 10 && !this.announcedUpcomingTurn && modifier !== 'straight') {
      this.announcedUpcomingTurn = true;
      const fmt = i18n.formatDistance(distToTurn);
      speechManager.speakUrgent(t.turnUpcoming(fmt.value, fmt.label, localizedTurn, street));
    }

    // 4. Cross-track off-route detection (> 35 meters away from path)
    if (currentStep.polyline.length >= 2) {
      const crossTrack = calculateCrossTrackDistance(
        loc,
        currentStep.polyline[0],
        currentStep.polyline[currentStep.polyline.length - 1]
      );
      if (crossTrack > 35 && !this.state.isOffRoute) {
        this.triggerOffRoute();
      }
    }

    this.notify();
  }

  /**
   * Off-route heading deviation check (> 25 degrees from the path)
   */
  private checkHeadingDeviation(): void {
    const route = this.state.route;
    if (!route || !this.userLocation) return;

    const currentStep = route.steps[this.state.currentStepIndex] || route.steps[0];
    const targetLoc = currentStep.maneuver.location || route.destinationCoords;
    const pathBearing = calculateBearing(this.userLocation, targetLoc);

    // Angular deviation: negative is drifting left, positive is drifting right
    const deviation = ((this.userHeading - pathBearing + 540) % 360) - 180;
    this.state.offRouteDeviationDeg = Math.round(deviation);

    const now = Date.now();
    const isDrifting = Math.abs(deviation) > 25;

    if (isDrifting) {
      const driftingSide: 'left' | 'right' = deviation < 0 ? 'left' : 'right';
      const turnCorrectionSide: 'left' | 'right' = driftingSide === 'left' ? 'right' : 'left';
      this.state.offRouteSide = driftingSide;

      if (!this.offRouteStartTime) {
        this.offRouteStartTime = now;
      }

      // 1. Play binaural left/right audio cue FIRST
      if (now - this.lastBinauralCueTime > 2500) {
        this.lastBinauralCueTime = now;
        audioEngine.playBinauralSteeringCue(turnCorrectionSide);
        hapticService.play('offRoute');
      }

      // 2. Speak correction ONLY if it persists > 5 seconds
      if (now - this.offRouteStartTime > 5000) {
        this.offRouteStartTime = now; // Reset timer for next spoken nudge
        const clock = degreesToClockDirection(turnCorrectionSide === 'right' ? 35 : -35);
        const t = i18n.t;
        const driftText = driftingSide === 'left' ? t.driftingLeft : t.driftingRight;
        const turnText = turnCorrectionSide === 'left' ? t.turnLeft : t.turnRight;

        speechManager.speakUrgent(t.driftingCorrection(driftText, turnText, clock));
      }
    } else {
      this.offRouteStartTime = 0;
      this.state.offRouteSide = undefined;
    }
  }

  private triggerOffRoute(): void {
    this.state.isOffRoute = true;
    audioEngine.playDangerAlert();
    hapticService.play('danger');
    speechManager.speakUrgent(i18n.t.offRoute);
    this.recalculateRoute();
  }

  private async recalculateRoute(): Promise<void> {
    if (!this.userLocation || !this.state.route) return;
    try {
      const destCoords = this.state.route.destinationCoords;
      const destName = this.state.route.destinationName;
      const newRoute = await this.routeProvider.getRoute(this.userLocation, destCoords, destName);
      this.state.route = newRoute;
      this.state.currentStepIndex = 0;
      this.state.isOffRoute = false;
      this.announcedUpcomingTurn = false;
      this.announcedTurnNow = false;
      this.notify();
    } catch {
      // Keep old route
    }
  }

  private localizeTurnModifier(modifier: string): string {
    const t = i18n.t;
    if (modifier.includes('slight left')) return t.turnSlightLeft;
    if (modifier.includes('slight right')) return t.turnSlightRight;
    if (modifier.includes('left')) return t.turnLeft;
    if (modifier.includes('right')) return t.turnRight;
    return 'straight';
  }
}

export const guidanceEngine = new GuidanceEngine();
