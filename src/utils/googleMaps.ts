import axios from 'axios';

export interface Coordinates {
  lat: number;
  lng: number;
}

export interface RouteData {
  distance: number; // in meters
  duration: number; // in seconds
  polyline: string; // Array of [lat, lng] coordinates as JSON string for Leaflet
}

/**
 * Calculate route using OSRM (Open Source Routing Machine)
 * 100% FREE - No API key required
 * 
 * OSRM Public API: http://router.project-osrm.org/
 * Documentation: http://project-osrm.org/docs/v5.24.0/api/
 * 
 * Note: This uses the public OSRM server. For production, consider:
 * - Hosting your own OSRM instance
 * - Rate limiting requests
 * - Caching routes
 * 
 * Falls back to Haversine distance calculation if OSRM fails
 */
export const calculateRoute = async (
  origin: Coordinates,
  destination: Coordinates
): Promise<RouteData> => {
  try {
    // OSRM API endpoint format: /route/v1/{profile}/{coordinates}
    // Coordinates are in lng,lat format
    const coordinates = `${origin.lng},${origin.lat};${destination.lng},${destination.lat}`;
    
    console.log(`🗺️  Calculating route from [${origin.lat}, ${origin.lng}] to [${destination.lat}, ${destination.lng}]`);
    
    // Use public OSRM server - NO API KEY REQUIRED
    // Add timeout and better error handling
    const response = await axios.get(
      `http://router.project-osrm.org/route/v1/driving/${coordinates}`,
      {
        params: {
          overview: 'full', // Get full route geometry
          geometries: 'geojson', // Return GeoJSON format
          steps: false, // We don't need turn-by-turn directions
        },
        timeout: 10000, // 10 second timeout
        validateStatus: (status) => status < 500, // Don't throw on 4xx errors
      }
    );

    // Check if route was successfully calculated
    if (response.data.code !== 'Ok' || !response.data.routes || response.data.routes.length === 0) {
      console.warn('⚠️  OSRM returned no routes, falling back to Haversine calculation');
      return calculateFallbackRoute(origin, destination);
    }

    const route = response.data.routes[0];

    // Convert GeoJSON coordinates [lng, lat] to Leaflet format [lat, lng]
    const geojsonCoords = route.geometry.coordinates;
    const leafletCoords = geojsonCoords.map((coord: [number, number]) => [coord[1], coord[0]]);

    console.log(`✅ OSRM route calculated: ${(route.distance / 1000).toFixed(2)} km, ${Math.round(route.duration / 60)} min`);

    // OSRM returns distance in meters and duration in seconds
    return {
      distance: route.distance, // meters
      duration: route.duration, // seconds
      polyline: JSON.stringify(leafletCoords), // Array of [lat, lng] for Leaflet
    };
  } catch (error: any) {
    console.error('❌ OSRM API error:', error.message);
    console.log('🔄 Falling back to Haversine distance calculation');
    
    // Fallback to Haversine calculation
    return calculateFallbackRoute(origin, destination);
  }
};

/**
 * Fallback route calculation using Haversine formula
 * Used when OSRM API is unavailable or fails
 */
const calculateFallbackRoute = (
  origin: Coordinates,
  destination: Coordinates
): RouteData => {
  // Calculate straight-line distance using Haversine
  const distance = calculateDistance(origin, destination);
  
  // Apply 1.3x multiplier for real road distance (typical for urban areas)
  const roadDistance = Math.round(distance * 1.3);
  
  // Estimate duration assuming 25 km/h average speed for electric scooter in city
  const averageSpeedKmh = 25;
  const durationSeconds = Math.round((roadDistance / 1000) * (3600 / averageSpeedKmh));
  
  // Create simple straight-line polyline
  const polyline = JSON.stringify([
    [origin.lat, origin.lng],
    [destination.lat, destination.lng]
  ]);
  
  console.log(`✅ Fallback route: ${(roadDistance / 1000).toFixed(2)} km (estimated), ${Math.round(durationSeconds / 60)} min`);
  
  return {
    distance: roadDistance,
    duration: durationSeconds,
    polyline,
  };
};

export const calculateDistance = (
  point1: Coordinates,
  point2: Coordinates
): number => {
  const R = 6371e3; // Earth's radius in meters
  const φ1 = (point1.lat * Math.PI) / 180;
  const φ2 = (point2.lat * Math.PI) / 180;
  const Δφ = ((point2.lat - point1.lat) * Math.PI) / 180;
  const Δλ = ((point2.lng - point1.lng) * Math.PI) / 180;

  const a =
    Math.sin(Δφ / 2) * Math.sin(Δφ / 2) +
    Math.cos(φ1) * Math.cos(φ2) * Math.sin(Δλ / 2) * Math.sin(Δλ / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

  return R * c; // Distance in meters
};

export const calculateFare = (distanceInMeters: number): number => {
  const distanceInKm = distanceInMeters / 1000;
  const baseFare = 50; // Base fare in currency units
  const perKmRate = 15; // Rate per km
  const minFare = 80; // Minimum fare
  
  const fare = baseFare + (distanceInKm * perKmRate);
  return Math.max(Math.round(fare), minFare);
};
