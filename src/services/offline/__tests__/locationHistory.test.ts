import { describe, it, expect, beforeEach } from 'vitest';
import { LocationHistoryService } from '../LocationHistory';

describe('LocationHistoryService', () => {
  let service: LocationHistoryService;

  beforeEach(() => {
    service = new LocationHistoryService();
    service.clear();
  });

  it('records and retrieves nearby saved locations within GPS distance', () => {
    const homeCoords = { lat: 37.7749, lng: -122.4194 };
    service.recordLocation('Home', homeCoords);

    // Current location is ~40 meters away
    const userLoc = { lat: 37.7752, lng: -122.4194 };
    const nearest = service.findNearestSavedPlace(userLoc);

    expect(nearest).not.toBeNull();
    expect(nearest?.location.name).toBe('Home');
    expect(nearest?.distanceMeters).toBeGreaterThan(20);
    expect(nearest?.distanceMeters).toBeLessThan(60);
  });

  it('provides offline location summary with heading and freshness', () => {
    service.recordLastAddress('742 Evergreen Terrace', { lat: 37.77, lng: -122.41 });
    const desc = service.getOfflineLocationDescription({ lat: 37.77, lng: -122.41 }, 90);

    expect(desc).toContain('Offline mode');
    expect(desc).toContain('742 Evergreen Terrace');
    expect(desc).toContain('90 degrees');
  });
});
