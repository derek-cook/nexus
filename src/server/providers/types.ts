// Bbox: lat/lon min/max corners
export interface FlightBounds {
  lamin: number;
  lamax: number;
  lomin: number;
  lomax: number;
}

// Circle query: center point + radius in nautical miles (adsb.lol native shape)
export interface FlightCircle {
  lat: number;
  lon: number;
  radiusNm: number;
}

// Provider-agnostic aircraft state. Fields are nullable because not every
// provider supplies every field (e.g. adsb.lol has no originCountry, OpenSky
// has no per-aircraft distance/bearing).
export interface AircraftSnapshot {
  icao24: string;
  callsign: string | null;
  originCountry: string | null;
  timePosition: number | null;
  lastContact: number;
  longitude: number | null;
  latitude: number | null;
  baroAltitude: number | null;
  geoAltitude: number | null;
  onGround: boolean;
  velocity: number | null;
  trueTrack: number | null;
  verticalRate: number | null;
  squawk: string | null;
  spi: boolean | null;
  positionSource: number | null;
  category: number | null;
  typecode: string | null;
  iconType: string;
}

export interface FlightDataProvider {
  name: string;
  fetchGlobal?(): Promise<AircraftSnapshot[]>;
  fetchCircle?(circle: FlightCircle): Promise<AircraftSnapshot[]>;
  fetchByIcao?(icao24: string): Promise<AircraftSnapshot | null>;
}

export type ProviderRole = "global" | "regional" | "tracking";
