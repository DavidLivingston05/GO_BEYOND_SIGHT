import { describe, it, expect } from 'vitest';
import { calculateHaversineDistance, calculateBearing } from '../RouteProvider';

describe('RouteProvider Math', () => {
  it('calculates accurate Haversine distances between geographic points', () => {
    const sanFrancisco = { lat: 37.7749, lng: -122.4194 };
    const sanJose = { lat: 37.3382, lng: -121.8863 };

    const distanceMeters = calculateHaversineDistance(sanFrancisco, sanJose);
    // Distance between SF and San Jose is approx 67-70 km
    expect(distanceMeters).toBeGreaterThan(65000);
    expect(distanceMeters).toBeLessThan(75000);
  });

  it('calculates bearings accurately', () => {
    const origin = { lat: 0, lng: 0 };
    const north = { lat: 1, lng: 0 };
    const east = { lat: 0, lng: 1 };

    expect(calculateBearing(origin, north)).toBeCloseTo(0, 0);
    expect(calculateBearing(origin, east)).toBeCloseTo(90, 0);
  });
});
