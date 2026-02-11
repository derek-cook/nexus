/**
 * Great-circle math utilities for position projection.
 * Uses Haversine "destination point" formula for dead reckoning.
 */

/** Position in decimal degrees */
export interface GeoPosition {
  latitude: number;
  longitude: number;
}

/** Velocity with speed in m/s and heading in degrees from north */
export interface GeoVelocity {
  speed: number; // m/s
  heading: number; // degrees clockwise from north (0-360)
}

/** Earth radius in meters */
const EARTH_RADIUS = 6371008.8;

/**
 * Project a position forward given velocity and time delta.
 * Uses Haversine "destination point" formula:
 *   lat2 = asin(sin(lat1) * cos(d/R) + cos(lat1) * sin(d/R) * cos(bearing))
 *   lon2 = lon1 + atan2(sin(bearing) * sin(d/R) * cos(lat1), cos(d/R) - sin(lat1) * sin(lat2))
 *
 * @param start Starting position
 * @param velocity Velocity (speed in m/s, heading in degrees)
 * @param deltaSeconds Time to project forward in seconds
 * @returns Projected position
 */
export function projectPosition(
  start: GeoPosition,
  velocity: GeoVelocity,
  deltaSeconds: number
): GeoPosition {
  // Distance traveled in meters
  const distance = velocity.speed * deltaSeconds;

  // If no movement, return start position
  if (distance === 0) {
    return { ...start };
  }

  // Convert to radians
  const lat1 = toRadians(start.latitude);
  const lon1 = toRadians(start.longitude);
  const bearing = toRadians(velocity.heading);

  // Angular distance (distance / earth radius)
  const angularDist = distance / EARTH_RADIUS;

  // Precompute trig values
  const sinLat1 = Math.sin(lat1);
  const cosLat1 = Math.cos(lat1);
  const sinAngDist = Math.sin(angularDist);
  const cosAngDist = Math.cos(angularDist);
  const sinBearing = Math.sin(bearing);
  const cosBearing = Math.cos(bearing);

  // Calculate new latitude
  const lat2 = Math.asin(
    sinLat1 * cosAngDist + cosLat1 * sinAngDist * cosBearing
  );

  // Calculate new longitude
  const lon2 =
    lon1 +
    Math.atan2(
      sinBearing * sinAngDist * cosLat1,
      cosAngDist - sinLat1 * Math.sin(lat2)
    );

  return {
    latitude: toDegrees(lat2),
    longitude: normalizeLongitude(toDegrees(lon2)),
  };
}

/** Convert degrees to radians */
function toRadians(degrees: number): number {
  return (degrees * Math.PI) / 180;
}

/** Convert radians to degrees */
function toDegrees(radians: number): number {
  return (radians * 180) / Math.PI;
}

/** Normalize longitude to [-180, 180] range */
function normalizeLongitude(lon: number): number {
  while (lon > 180) lon -= 360;
  while (lon < -180) lon += 360;
  return lon;
}
