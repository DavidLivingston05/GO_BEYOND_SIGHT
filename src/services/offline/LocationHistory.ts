// Location History for Offline GPS Proximity & "Where am I?"
// Saves the last 20 online places so offline mode can identify nearby locations using GPS distance
import type { LatLng, SavedLocation } from '../../types';
import { calculateHaversineDistance, calculateBearing } from '../walk/RouteProvider';
import { degreesToCardinal } from '../objectDetector';

const STORAGE_LOCATIONS_KEY = 'beyond_sight_saved_locations';
const LAST_REVERSE_GEOCODE_KEY = 'beyond_sight_last_reverse_geocode';

export class LocationHistoryService {
  private savedLocations: SavedLocation[] = [];
  private lastAddressCache: { address: string; coords: LatLng; timestamp: number } | null = null;

  constructor() {
    this.loadLocations();
  }

  private loadLocations(): void {
    if (typeof localStorage === 'undefined') return;
    try {
      const raw = localStorage.getItem(STORAGE_LOCATIONS_KEY);
      if (raw) {
        this.savedLocations = JSON.parse(raw);
      }
      const rawAddr = localStorage.getItem(LAST_REVERSE_GEOCODE_KEY);
      if (rawAddr) {
        this.lastAddressCache = JSON.parse(rawAddr);
      }
    } catch {
      this.savedLocations = [];
    }
  }

  private persist(): void {
    if (typeof localStorage === 'undefined') return;
    try {
      // Keep only the last 20 locations
      const trimmed = this.savedLocations.slice(0, 20);
      localStorage.setItem(STORAGE_LOCATIONS_KEY, JSON.stringify(trimmed));
    } catch {
      // Ignore
    }
  }

  /**
   * Records a place visited or searched while online
   */
  public recordLocation(name: string, coords: LatLng): void {
    const existingIndex = this.savedLocations.findIndex(
      (loc) => loc.name.toLowerCase().trim() === name.toLowerCase().trim()
    );

    const item: SavedLocation = {
      id: `loc_${Date.now()}`,
      name: name.trim(),
      lat: coords.lat,
      lng: coords.lng,
      timestamp: Date.now(),
    };

    if (existingIndex >= 0) {
      this.savedLocations[existingIndex] = item;
    } else {
      this.savedLocations.unshift(item);
    }

    this.persist();
  }

  /**
   * Records the last successful reverse geocode street address & timestamp
   */
  public recordLastAddress(address: string, coords: LatLng): void {
    const data = {
      address,
      coords,
      timestamp: Date.now(),
    };
    this.lastAddressCache = data;

    if (typeof localStorage !== 'undefined') {
      try {
        localStorage.setItem(LAST_REVERSE_GEOCODE_KEY, JSON.stringify(data));
      } catch {
        // Ignore
      }
    }
    this.recordLocation(address, coords);
  }

  public getLastKnownAddress(): { address: string; coords: LatLng; timestamp: number } | null {
    if (this.lastAddressCache) return this.lastAddressCache;
    if (typeof localStorage !== 'undefined') {
      try {
        const raw = localStorage.getItem(LAST_REVERSE_GEOCODE_KEY);
        if (raw) return JSON.parse(raw);
      } catch {
        // Ignore
      }
    }
    return null;
  }

  /**
   * Find nearest saved place to user's current offline GPS coordinates
   */
  public findNearestSavedPlace(currentLoc: LatLng): {
    location: SavedLocation;
    distanceMeters: number;
    steps: number;
    bearingDeg: number;
    cardinal: string;
  } | null {
    if (this.savedLocations.length === 0) return null;

    let closest: SavedLocation | null = null;
    let minDistance = Infinity;

    for (const loc of this.savedLocations) {
      const dist = calculateHaversineDistance(currentLoc, { lat: loc.lat, lng: loc.lng });
      if (dist < minDistance) {
        minDistance = dist;
        closest = loc;
      }
    }

    if (!closest) return null;

    const bearing = calculateBearing(currentLoc, { lat: closest.lat, lng: closest.lng });
    const cardinal = degreesToCardinal(bearing);

    return {
      location: closest,
      distanceMeters: minDistance,
      steps: Math.max(1, Math.round(minDistance / 0.75)),
      bearingDeg: Math.round(bearing),
      cardinal,
    };
  }

  /**
   * Generates offline spoken answer for "Where am I?"
   */
  public getOfflineLocationDescription(
    currentLoc: LatLng | null,
    userHeading: number
  ): string {
    const cardinalHeading = degreesToCardinal(userHeading);
    const lastAddrInfo = this.getLastKnownAddress();

    let freshnessText = '';
    if (lastAddrInfo) {
      const minutesAgo = Math.max(1, Math.round((Date.now() - lastAddrInfo.timestamp) / 60000));
      freshnessText = ` Last online address check was ${minutesAgo} minute${minutesAgo === 1 ? '' : 's'} ago near ${lastAddrInfo.address}.`;
    }

    if (currentLoc) {
      const nearest = this.findNearestSavedPlace(currentLoc);
      if (nearest && nearest.distanceMeters < 300) {
        return `Offline mode. You are near ${nearest.location.name}, about ${nearest.distanceMeters} meters (${nearest.steps} steps) towards ${nearest.cardinal}. Facing ${userHeading} degrees ${cardinalHeading}.${freshnessText}`;
      }
    }

    return `Offline mode. You are facing heading ${cardinalHeading} at ${userHeading} degrees.${freshnessText}`;
  }

  public clear(): void {
    this.savedLocations = [];
    if (typeof window === 'undefined') return;
    try {
      localStorage.removeItem(STORAGE_LOCATIONS_KEY);
      localStorage.removeItem(LAST_REVERSE_GEOCODE_KEY);
    } catch {
      // Ignore
    }
  }
}

export const locationHistoryService = new LocationHistoryService();
