export type SpatialZone = 'left' | 'center' | 'right';
export type ClockDirection = "10 o'clock" | "12 o'clock" | "2 o'clock";
export type ProximityTier = 'danger' | 'close' | 'far';

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
}
