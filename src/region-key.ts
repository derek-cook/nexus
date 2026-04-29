// Shared by client and server. Pure logic.

export interface RegionCenter {
  lat: number;
  lon: number;
}

export interface RegionCircle {
  lat: number;
  lon: number;
  radiusNm: number;
}

export interface RegionSnap {
  key: string;
  circle: RegionCircle;
  channel: string;
}

const GRID_DEG = 0.5;
const ADSBLOL_MAX_RADIUS_NM = 250;

export const REGION_CHANNEL_PREFIX = "aircraft:region:";
export const DEFAULT_REGION_RADIUS_NM = 100;

// Snaps a camera-target lat/lon to a 0.5° grid so neighbours share a poller.
// Two clients within ~55 km (one cell) hit the same channel.
export function snapCenter(
  center: RegionCenter,
  radiusNm: number = DEFAULT_REGION_RADIUS_NM
): RegionSnap {
  const lat = Math.round(center.lat / GRID_DEG) * GRID_DEG;
  const lon = Math.round(center.lon / GRID_DEG) * GRID_DEG;
  const radius = Math.min(ADSBLOL_MAX_RADIUS_NM, Math.max(1, radiusNm));
  const key = `${GRID_DEG}:${lat.toFixed(2)}:${lon.toFixed(2)}:${radius}`;
  return {
    key,
    circle: { lat, lon, radiusNm: radius },
    channel: `${REGION_CHANNEL_PREFIX}${key}`,
  };
}

export function regionKeyFromChannel(channel: string): string | null {
  if (!channel.startsWith(REGION_CHANNEL_PREFIX)) return null;
  const key = channel.slice(REGION_CHANNEL_PREFIX.length);
  return key.length > 0 ? key : null;
}
