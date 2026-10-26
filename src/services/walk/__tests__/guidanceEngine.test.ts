import { describe, it, expect, vi } from 'vitest';
import {
  GuidanceEngine,
  degreesToClockDirection,
  calculateCrossTrackDistance,
} from '../GuidanceEngine';
import type { IRouteProvider } from '../RouteProvider';
import type { LatLng, WalkRoute } from '../../../types';

describe('GuidanceEngine Logic', () => {
  it('converts relative angles to clock directions accurately', () => {
    expect(degreesToClockDirection(0)).toBe("12 o'clock");
    expect(degreesToClockDirection(30)).toBe("1 o'clock");
    expect(degreesToClockDirection(60)).toBe("2 o'clock");
    expect(degreesToClockDirection(90)).toBe("3 o'clock");
    expect(degreesToClockDirection(-30)).toBe("11 o'clock");
    expect(degreesToClockDirection(-60)).toBe("10 o'clock");
    expect(degreesToClockDirection(-90)).toBe("9 o'clock");
  });

  it('calculates cross-track distance correctly', () => {
    const start: LatLng = { lat: 37.78, lng: -122.41 };
    const end: LatLng = { lat: 37.79, lng: -122.41 }; // Straight north line
    // Point slightly to the east
    const userLoc: LatLng = { lat: 37.785, lng: -122.408 };

    const dist = calculateCrossTrackDistance(userLoc, start, end);
    expect(dist).toBeGreaterThan(100);
  });

  it('handles destination confirmation and start of route', async () => {
    const mockRoute: WalkRoute = {
      destinationName: 'City Library',
      destinationCoords: { lat: 37.785, lng: -122.415 },
      totalDistanceMeters: 300,
      totalDurationSeconds: 240,
      steps: [
        {
          instruction: 'Walk straight',
          distanceMeters: 150,
          durationSeconds: 120,
          maneuver: {
            type: 'depart',
            modifier: 'straight',
            location: { lat: 37.78, lng: -122.416 },
          },
          polyline: [
            { lat: 37.78, lng: -122.416 },
            { lat: 37.782, lng: -122.416 },
          ],
        },
        {
          instruction: 'Turn right',
          distanceMeters: 150,
          durationSeconds: 120,
          maneuver: {
            type: 'turn',
            modifier: 'right',
            location: { lat: 37.782, lng: -122.416 },
          },
          polyline: [
            { lat: 37.782, lng: -122.416 },
            { lat: 37.785, lng: -122.415 },
          ],
        },
      ],
      fullPolyline: [
        { lat: 37.78, lng: -122.416 },
        { lat: 37.782, lng: -122.416 },
        { lat: 37.785, lng: -122.415 },
      ],
    };

    const mockProvider: IRouteProvider = {
      geocode: vi.fn().mockResolvedValue([
        {
          name: 'City Library',
          displayName: 'City Library, 100 Main St',
          lat: 37.785,
          lng: -122.415,
        },
      ]),
      getRoute: vi.fn().mockResolvedValue(mockRoute),
      reverseGeocode: vi.fn().mockResolvedValue('100 Main St'),
    };

    const engine = new GuidanceEngine(mockProvider);
    await engine.startWalkMode('City Library', { lat: 37.78, lng: -122.416 });

    expect(engine.getState().status).toBe('confirming_destination');

    await engine.confirmDestination(0);
    expect(engine.getState().status).toBe('walking');
    expect(engine.getState().route?.destinationName).toBe('City Library');
  });

  it('detects arrival when within 10 meters of destination', async () => {
    const mockRoute: WalkRoute = {
      destinationName: 'Coffee Shop',
      destinationCoords: { lat: 37.78, lng: -122.41 },
      totalDistanceMeters: 50,
      totalDurationSeconds: 40,
      steps: [
        {
          instruction: 'Arrive at Coffee Shop',
          distanceMeters: 5,
          durationSeconds: 4,
          maneuver: {
            type: 'arrive',
            modifier: 'straight',
            location: { lat: 37.78, lng: -122.41 },
          },
          polyline: [{ lat: 37.78, lng: -122.41 }],
        },
      ],
      fullPolyline: [{ lat: 37.78, lng: -122.41 }],
    };

    const mockProvider: IRouteProvider = {
      geocode: vi.fn(),
      getRoute: vi.fn().mockResolvedValue(mockRoute),
      reverseGeocode: vi.fn(),
    };

    const engine = new GuidanceEngine(mockProvider);
    // Force set route
    (engine as any).state.route = mockRoute;
    (engine as any).state.status = 'walking';

    // Simulate location at 5 meters from destination
    engine.updateLocation({ lat: 37.78002, lng: -122.41002 });
    expect(engine.getState().status).toBe('arrived');
  });
});
