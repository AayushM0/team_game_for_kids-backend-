/**
 * SwiftGo Electric Scooter Fare Calculator
 * India-specific pricing in INR (₹)
 */

export type ScooterType = 'lite' | 'city' | 'plus';

export interface FarePricing {
  baseFare: number;      // Base fare in INR
  perKmRate: number;     // Rate per kilometer in INR
  minimumFare: number;   // Minimum fare in INR
  maxDistance: number;   // Maximum allowed distance in km
}

// Indian Rupee pricing for electric scooters
const SCOOTER_PRICING: Record<ScooterType, FarePricing> = {
  lite: {
    baseFare: 20,        // ₹20
    perKmRate: 8,        // ₹8/km
    minimumFare: 40,     // ₹40
    maxDistance: 15,     // 15 km max
  },
  city: {
    baseFare: 30,        // ₹30
    perKmRate: 10,       // ₹10/km
    minimumFare: 55,     // ₹55
    maxDistance: 15,     // 15 km max
  },
  plus: {
    baseFare: 40,        // ₹40
    perKmRate: 12,       // ₹12/km
    minimumFare: 70,     // ₹70
    maxDistance: 15,     // 15 km max
  },
};

/**
 * Calculate fare for electric scooter ride
 * @param distanceInMeters - Distance in meters
 * @param scooterType - Type of electric scooter
 * @returns Fare in INR (₹)
 */
export const calculateScooterFare = (
  distanceInMeters: number,
  scooterType: ScooterType = 'city'
): number => {
  const distanceInKm = distanceInMeters / 1000;
  const pricing = SCOOTER_PRICING[scooterType];

  // Calculate fare
  const calculatedFare = pricing.baseFare + (distanceInKm * pricing.perKmRate);
  
  // Apply minimum fare
  const fare = Math.max(calculatedFare, pricing.minimumFare);
  
  // Round to nearest rupee
  return Math.round(fare);
};

/**
 * Get pricing details for a scooter type
 */
export const getScooterPricing = (scooterType: ScooterType): FarePricing => {
  return SCOOTER_PRICING[scooterType];
};

/**
 * Validate if distance is within scooter limits
 */
export const isDistanceValid = (
  distanceInMeters: number,
  scooterType: ScooterType
): boolean => {
  const distanceInKm = distanceInMeters / 1000;
  return distanceInKm <= SCOOTER_PRICING[scooterType].maxDistance;
};

/**
 * Get fare estimate for all scooter types
 */
export const getAllScooterFares = (distanceInMeters: number): Record<ScooterType, number> => {
  return {
    lite: calculateScooterFare(distanceInMeters, 'lite'),
    city: calculateScooterFare(distanceInMeters, 'city'),
    plus: calculateScooterFare(distanceInMeters, 'plus'),
  };
};
