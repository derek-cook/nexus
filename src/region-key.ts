// Shared by client and server. Pure logic.

export interface RegionBounds {
  lamin: number;
  lamax: number;
  lomin: number;
  lomax: number;
}

export interface RegionCircle {
  lat: number;
  lon: number;
  radiusNm: number;
}

export interface RegionSnap {
  key: string;
  circle: RegionCircle;
  channel: string; // canonical aircraft:region:<key>
}

export type RegionSnapResult = RegionSnap | { tooLarge: true };

const FINE_GRID_DEG = 0.25;
const COARSE_GRID_DEG = 1.0;
const FINE_MAX_DIM_DEG = 4.0;
const COARSE_MAX_DIM_DEG = 30.0;

const KM_PER_DEG_LAT = 111.0;
const NM_PER_KM = 0.539957;
const ADSBLOL_MAX_RADIUS_NM = 250;

export const REGION_CHANNEL_PREFIX = "aircraft:region:";

export function snapBounds(bounds: RegionBounds): RegionSnapResult {
  const { lamin, lamax, lomin, lomax } = bounds;
  const width = lomax - lomin;
  const height = lamax - lamin;
  const maxDim = Math.max(Math.abs(width), Math.abs(height));

  let grid: number;
  if (maxDim < FINE_MAX_DIM_DEG) grid = FINE_GRID_DEG;
  else if (maxDim < COARSE_MAX_DIM_DEG) grid = COARSE_GRID_DEG;
  else return { tooLarge: true };

  const sLamin = Math.floor(lamin / grid) * grid;
  const sLamax = Math.ceil(lamax / grid) * grid;
  const sLomin = Math.floor(lomin / grid) * grid;
  const sLomax = Math.ceil(lomax / grid) * grid;

  const cellsW = Math.max(1, Math.round((sLomax - sLomin) / grid));
  const cellsH = Math.max(1, Math.round((sLamax - sLamin) / grid));

  const lat = (sLamin + sLamax) / 2;
  const lon = (sLomin + sLomax) / 2;

  const latKm = (sLamax - sLamin) * KM_PER_DEG_LAT;
  const lonKm =
    (sLomax - sLomin) * KM_PER_DEG_LAT * Math.cos((lat * Math.PI) / 180);
  const halfDiagKm = Math.sqrt(latKm * latKm + lonKm * lonKm) / 2;
  const radiusNm = Math.min(
    ADSBLOL_MAX_RADIUS_NM,
    halfDiagKm * NM_PER_KM * 1.1
  );

  const key = `${grid}:${sLamin.toFixed(2)}:${sLomin.toFixed(2)}:${cellsW}x${cellsH}`;
  return {
    key,
    circle: { lat, lon, radiusNm },
    channel: `${REGION_CHANNEL_PREFIX}${key}`,
  };
}

export function regionKeyFromChannel(channel: string): string | null {
  if (!channel.startsWith(REGION_CHANNEL_PREFIX)) return null;
  return channel.slice(REGION_CHANNEL_PREFIX.length);
}

export function isRegionTooLarge(
  result: RegionSnapResult
): result is { tooLarge: true } {
  return (result as { tooLarge?: boolean }).tooLarge === true;
}
