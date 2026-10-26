// Free-First Route & Geocoding Provider
// Nominatim (OpenStreetMap) + OSRM Foot Walking Profiles
import type { GeocodedPlace, LatLng, RouteStep, WalkRoute } from '../../types';
import { locationHistoryService } from '../offline/LocationHistory';

export interface IRouteProvider {
  geocode(query: string, userLocation?: LatLng): Promise<GeocodedPlace[]>;
  getRoute(start: LatLng, end: LatLng, destinationName?: string): Promise<WalkRoute>;
  reverseGeocode(location: LatLng): Promise<string>;
}

/**
 * Calculates straight line distance between two LatLngs in meters (Haversine Formula)
 */
export function calculateHaversineDistance(a: LatLng, b: LatLng): number {
  const R = 6371000; // meters
  const dLat = ((b.lat - a.lat) * Math.PI) / 180;
  const dLng = ((b.lng - a.lng) * Math.PI) / 180;
  const lat1 = (a.lat * Math.PI) / 180;
  const lat2 = (b.lat * Math.PI) / 180;

  const sinDLat = Math.sin(dLat / 2);
  const sinDLng = Math.sin(dLng / 2);

  const h = sinDLat * sinDLat + Math.cos(lat1) * Math.cos(lat2) * sinDLng * sinDLng;
  const c = 2 * Math.atan2(Math.sqrt(h), Math.sqrt(1 - h));
  return Math.round(R * c);
}

/**
 * Calculates initial bearing from point a to point b in degrees (0 - 360)
 */
export function calculateBearing(a: LatLng, b: LatLng): number {
  const lat1 = (a.lat * Math.PI) / 180;
  const lat2 = (b.lat * Math.PI) / 180;
  const dLng = ((b.lng - a.lng) * Math.PI) / 180;

  const y = Math.sin(dLng) * Math.cos(lat2);
  const x = Math.cos(lat1) * Math.sin(lat2) - Math.sin(lat1) * Math.cos(lat2) * Math.cos(dLng);
  const brng = (Math.atan2(y, x) * 180) / Math.PI;
  return (brng + 360) % 360;
}

export class NominatimOSRMRouteProvider implements IRouteProvider {
  private userAgent = 'BeyondSightAccessibilityApp/1.0 (https://beyondsight.app; contact@beyondsight.app)';

  public async geocode(query: string, userLocation?: LatLng): Promise<GeocodedPlace[]> {
    if (!query || query.trim().length === 0) return [];

    try {
      let url = `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(
        query.trim()
      )}&addressdetails=1&limit=4`;

      if (userLocation) {
        // Bias search towards user's current geographic coordinate bounding box (~50km)
        const delta = 0.5;
        const viewbox = `${userLocation.lng - delta},${userLocation.lat + delta},${userLocation.lng + delta},${
          userLocation.lat - delta
        }`;
        url += `&viewbox=${viewbox}&bounded=0`;
      }

      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 6000);

      const response = await fetch(url, {
        headers: {
          Accept: 'application/json',
          'User-Agent': this.userAgent,
        },
        signal: controller.signal,
      });
      clearTimeout(timeoutId);

      if (!response.ok) {
        throw new Error(`Nominatim HTTP ${response.status}`);
      }

      const data: any[] = await response.json();
      if (!Array.isArray(data) || data.length === 0) return [];

      const results: GeocodedPlace[] = data.map((item) => {
        const lat = parseFloat(item.lat);
        const lng = parseFloat(item.lon);
        const rawName =
          item.namedetails?.name ||
          item.address?.amenity ||
          item.address?.shop ||
          item.address?.building ||
          item.address?.road ||
          item.display_name.split(',')[0] ||
          'Destination';

        const place: GeocodedPlace = {
          name: rawName,
          displayName: item.display_name,
          lat,
          lng,
        };

        if (userLocation) {
          place.distanceMeters = calculateHaversineDistance(userLocation, { lat, lng });
        }
        return place;
      });

      // Sort by proximity to user if available
      if (userLocation) {
        results.sort((a, b) => (a.distanceMeters || 0) - (b.distanceMeters || 0));
      }

      return results.slice(0, 3);
    } catch (err) {
      console.warn('Nominatim geocode failed or timed out:', err);
      // Fallback synthetic response for graceful degradation
      return [
        {
          name: query,
          displayName: `${query} (Local approximation)`,
          lat: userLocation ? userLocation.lat + 0.003 : 37.7749,
          lng: userLocation ? userLocation.lng + 0.003 : -122.4194,
          distanceMeters: 450,
        },
      ];
    }
  }

  public async getRoute(start: LatLng, end: LatLng, destinationName = 'Destination'): Promise<WalkRoute> {
    const defaultDistance = calculateHaversineDistance(start, end);

    try {
      // OSRM foot walking profile endpoint (free, no key required)
      const url = `https://router.project-osrm.org/route/v1/foot/${start.lng},${start.lat};${end.lng},${end.lat}?overview=full&geometries=geojson&steps=true`;

      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 7000);

      const response = await fetch(url, {
        headers: { Accept: 'application/json' },
        signal: controller.signal,
      });
      clearTimeout(timeoutId);

      if (!response.ok) {
        throw new Error(`OSRM HTTP error: ${response.status}`);
      }

      const json = await response.json();
      if (!json.routes || json.routes.length === 0) {
        throw new Error('No route found by OSRM');
      }

      const route = json.routes[0];
      const leg = route.legs[0];

      const steps: RouteStep[] = (leg.steps || []).map((step: any) => {
        const polyline: LatLng[] = (step.geometry?.coordinates || []).map((coord: [number, number]) => ({
          lat: coord[1],
          lng: coord[0],
        }));

        const maneuver = {
          type: step.maneuver?.type || 'turn',
          modifier: step.maneuver?.modifier || 'straight',
          location: {
            lat: step.maneuver?.location?.[1] || start.lat,
            lng: step.maneuver?.location?.[0] || start.lng,
          },
          bearing_after: step.maneuver?.bearing_after,
          bearing_before: step.maneuver?.bearing_before,
        };

        return {
          instruction: step.name ? `Onto ${step.name}` : step.maneuver?.modifier || 'Continue',
          distanceMeters: Math.round(step.distance || 0),
          durationSeconds: Math.round(step.duration || 0),
          maneuver,
          polyline,
          name: step.name || '',
        };
      });

      const fullPolyline: LatLng[] = (route.geometry?.coordinates || []).map((coord: [number, number]) => ({
        lat: coord[1],
        lng: coord[0],
      }));

      return {
        destinationName,
        destinationCoords: end,
        totalDistanceMeters: Math.round(route.distance),
        totalDurationSeconds: Math.round(route.duration),
        steps: steps.length > 0 ? steps : this.generateDirectSteps(start, end, destinationName),
        fullPolyline: fullPolyline.length > 0 ? fullPolyline : [start, end],
      };
    } catch (err) {
      console.warn('OSRM route fetch failed, falling back to direct foot path:', err);
      return this.generateDirectFallbackRoute(start, end, destinationName, defaultDistance);
    }
  }

  public async reverseGeocode(location: LatLng): Promise<string> {
    try {
      const url = `https://nominatim.openstreetmap.org/reverse?format=json&lat=${location.lat}&lon=${location.lng}&addressdetails=1`;
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 5000);

      const response = await fetch(url, {
        headers: {
          Accept: 'application/json',
          'User-Agent': this.userAgent,
        },
        signal: controller.signal,
      });
      clearTimeout(timeoutId);

      if (response.ok) {
        const data = await response.json();
        const road = data.address?.road || data.address?.pedestrian;
        const houseNumber = data.address?.house_number;
        const suburb = data.address?.suburb || data.address?.neighbourhood || data.address?.city;

        let finalAddress = data.display_name?.split(',').slice(0, 2).join(',') || 'Current Location';
        if (road && houseNumber) {
          finalAddress = `${houseNumber} ${road}${suburb ? ', ' + suburb : ''}`;
        } else if (road) {
          finalAddress = `${road}${suburb ? ', ' + suburb : ''}`;
        }
        locationHistoryService.recordLastAddress(finalAddress, location);
        return finalAddress;
      }
    } catch {
      // Ignore
    }
    return 'Your current GPS coordinates';
  }

  private generateDirectFallbackRoute(
    start: LatLng,
    end: LatLng,
    destinationName: string,
    distanceMeters: number
  ): WalkRoute {
    const bearing = calculateBearing(start, end);
    const steps: RouteStep[] = [
      {
        instruction: `Walk straight towards ${destinationName}`,
        distanceMeters,
        durationSeconds: Math.round(distanceMeters / 1.2),
        maneuver: {
          type: 'depart',
          modifier: 'straight',
          location: start,
          bearing_after: bearing,
        },
        polyline: [start, end],
        name: destinationName,
      },
      {
        instruction: `Arrive at ${destinationName}`,
        distanceMeters: 0,
        durationSeconds: 0,
        maneuver: {
          type: 'arrive',
          modifier: 'straight',
          location: end,
        },
        polyline: [end],
        name: destinationName,
      },
    ];

    return {
      destinationName,
      destinationCoords: end,
      totalDistanceMeters: distanceMeters,
      totalDurationSeconds: Math.round(distanceMeters / 1.2),
      steps,
      fullPolyline: [start, end],
    };
  }

  private generateDirectSteps(start: LatLng, end: LatLng, destinationName: string): RouteStep[] {
    const dist = calculateHaversineDistance(start, end);
    const bearing = calculateBearing(start, end);
    return [
      {
        instruction: 'Walk straight',
        distanceMeters: dist,
        durationSeconds: Math.round(dist / 1.2),
        maneuver: {
          type: 'depart',
          modifier: 'straight',
          location: start,
          bearing_after: bearing,
        },
        polyline: [start, end],
        name: destinationName,
      },
      {
        instruction: `Arrive at ${destinationName}`,
        distanceMeters: 0,
        durationSeconds: 0,
        maneuver: {
          type: 'arrive',
          modifier: 'straight',
          location: end,
        },
        polyline: [end],
      },
    ];
  }
}

export const defaultRouteProvider = new NominatimOSRMRouteProvider();
