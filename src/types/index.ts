export type SpatialZone = 'left' | 'center' | 'right';
export type ClockDirection = "10 o'clock" | "12 o'clock" | "2 o'clock" | "9 o'clock" | "11 o'clock" | "1 o'clock" | "3 o'clock";
export type ProximityTier = 'danger' | 'close' | 'far';
export type CardinalDirection = 'N' | 'NE' | 'E' | 'SE' | 'S' | 'SW' | 'W' | 'NW';
export type NavigationMode = 'home' | 'road';

export interface BoundingBox {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface DetectedObject {
  id: string;
  class: string;
  score: number;
  bbox: [number, number, number, number]; // [x, y, width, height]
  zone: SpatialZone;
  clockDirection: ClockDirection;
  proximityTier: ProximityTier;
  estimatedMeters: number;
  estimatedSteps: number;
  guidanceText: string;
  matchedPersonName?: string;
  // Direction & Stance Intelligence
  cardinalDirection?: CardinalDirection;
  relativeBearingDegrees?: number; // -180 to +180 relative to user heading
  compassHeading?: number; // 0 - 360 absolute compass
  personFacing?: 'facing you' | 'facing away' | 'side profile';
  isSelfUser?: boolean; // User detected in front camera/webcam
  // Road & Vehicle Safety Sentinel
  isVehicle?: boolean;
  isApproachingFast?: boolean;
  approachSpeedRatio?: number;
  trafficLightState?: 'red' | 'green' | 'yellow' | 'unknown';
}

export interface DoorGuidanceInfo {
  detected: boolean;
  direction: ClockDirection;
  cardinalDirection: CardinalDirection;
  degrees: number; // e.g. 340 deg
  turnOffsetDeg: number; // e.g. -20 deg (turn 20 left)
  confidence: number;
  meters: number;
  estimatedSteps: number;
}

export interface RoadSentinelState {
  isActive: boolean;
  vehiclesCount: number;
  approachingVehiclesCount: number;
  trafficLightState: 'red' | 'green' | 'yellow' | 'none';
  crosswalkDetected: boolean;
  curbWarning: boolean;
}

export interface PersonProfile {
  id: string;
  name: string;
  thumbnail: string; // Base64 data URL
  colorHistogram: number[]; // Normalized color histogram
  enrolledAt: number;
  notes?: string;
}

export type AssistantState = 'idle' | 'listening' | 'thinking' | 'speaking';

export interface SpeechQueueItem {
  id: string;
  text: string;
  priority: 'urgent' | 'interactive' | 'background';
  createdAt: number;
}

export interface VisionSettings {
  geminiApiKey: string;
  geminiModel: string;
  spatialRadarEnabled: boolean;
  radarVolume: number;
  speechRate: number;
  speechPitch: number;
  selectedVoiceURI: string;
  highContrastMode: boolean;
  minConfidence: number;
  autoGuidance: boolean;
  defaultMode?: NavigationMode;
  ignoreSelfInFrontCamera?: boolean;
}
