import { getAircraftMeta, classifyByCategory } from "./aircraft-db";

const DEBUG_FETCH = true;

// OpenSky Network API response types
export interface OpenSkyState {
  icao24: string;
  callsign: string | null;
  originCountry: string;
  timePosition: number | null;
  lastContact: number;
  longitude: number | null;
  latitude: number | null;
  baroAltitude: number | null;
  onGround: boolean;
  velocity: number | null;
  trueTrack: number | null;
  verticalRate: number | null;
  geoAltitude: number | null;
  squawk: string | null;
  spi: boolean | null;
  positionSource: number | null;
  category: number | null;
  typecode: string | null;
  iconType: string;
}

interface OpenSkyResponse {
  time: number;
  states: (string | number | boolean | null)[][] | null;
}

export interface AircraftBounds {
  lamin: number;
  lomin: number;
  lamax: number;
  lomax: number;
}

// LA metro area bounding box
export const LA_BOUNDS: AircraftBounds = {
  lamin: 33.5, // south of Long Beach
  lamax: 34.4, // north of Burbank
  lomin: -119.7, // Pacific coast
  lomax: -117.4, // past Ontario airport
};

// Parse OpenSky API response into typed objects
function parseOpenSkyStates(data: OpenSkyResponse): OpenSkyState[] {
  if (!data.states) return [];

  return data.states.map((state) => ({
    icao24: state[0] as string,
    callsign: (state[1] as string)?.trim() || null,
    originCountry: state[2] as string,
    timePosition: state[3] as number | null,
    lastContact: state[4] as number,
    longitude: state[5] as number | null,
    latitude: state[6] as number | null,
    baroAltitude: state[7] as number | null,
    onGround: state[8] as boolean,
    velocity: state[9] as number | null,
    trueTrack: state[10] as number | null,
    verticalRate: state[11] as number | null,
    geoAltitude: state[13] as number | null,
    squawk: state[14] as string | null,
    spi: state[15] as boolean | null,
    positionSource: state[16] as number | null,
    category: state[17] as number | null,
    typecode: null,
    iconType: "unknown",
  }));
}

// Enrich states with metadata from aircraft database
function enrichWithMetadata(states: OpenSkyState[]): OpenSkyState[] {
  for (const state of states) {
    const meta = getAircraftMeta(state.icao24);
    if (meta) {
      state.typecode = meta.typecode || null;
      state.iconType =
        meta.iconType !== "unknown"
          ? meta.iconType
          : classifyByCategory(state.category);
    } else {
      state.iconType = classifyByCategory(state.category);
    }
  }
  return states;
}

// OpenSky OAuth2 credentials from environment
const OPENSKY_CLIENT_ID = process.env.OPENSKY_CLIENT_ID;
const OPENSKY_CLIENT_SECRET = process.env.OPENSKY_CLIENT_SECRET;
const OPENSKY_TOKEN_URL =
  "https://auth.opensky-network.org/auth/realms/opensky-network/protocol/openid-connect/token";

// Token cache
let accessToken: string | null = null;
let tokenExpiresAt: number = 0;

// Get or refresh OAuth2 access token
async function getAccessToken(): Promise<string | null> {
  if (!OPENSKY_CLIENT_ID || !OPENSKY_CLIENT_SECRET) {
    return null;
  }

  // Return cached token if still valid, with a 3 minute buffer
  if (accessToken && Date.now() < tokenExpiresAt - 3 * 60_000) {
    console.log("getAccessToken: returning cached token");
    return accessToken;
  }

  try {
    const response = await fetch(OPENSKY_TOKEN_URL, {
      verbose: DEBUG_FETCH,
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: new URLSearchParams({
        grant_type: "client_credentials",
        client_id: OPENSKY_CLIENT_ID,
        client_secret: OPENSKY_CLIENT_SECRET,
      }),
    });

    if (!response.ok) {
      console.error(`OpenSky token error: ${response.status}`);
      return null;
    }

    const data = await response.json();
    accessToken = data.access_token;
    // Token expires in 30 min, but use the actual expires_in value
    tokenExpiresAt = Date.now() + (data.expires_in || 1800) * 1000;
    console.log("OpenSky access token refreshed", data);
    return accessToken;
  } catch (error) {
    console.error("Failed to get OpenSky token:", error);
    return null;
  }
}

// Fetch aircraft data from OpenSky Network API
export async function fetchAircraftData(
  bounds?: AircraftBounds
): Promise<OpenSkyState[]> {
  try {
    let url = "https://opensky-network.org/api/states/all";

    if (bounds) {
      const params = new URLSearchParams({
        lamin: bounds.lamin.toString(),
        lomin: bounds.lomin.toString(),
        lamax: bounds.lamax.toString(),
        lomax: bounds.lomax.toString(),
        extended: "1",
      });
      url += `?${params}`;
    }

    const headers: HeadersInit = {};
    const token = await getAccessToken();
    if (token) {
      headers.Authorization = `Bearer ${token}`;
    }

    const response = await fetch(url, { headers, verbose: DEBUG_FETCH });

    if (response.status === 401) {
      console.error("401: OpenSky token expired, clearing cache and retrying");
      // Token expired, clear cache and retry once
      accessToken = null;
      tokenExpiresAt = 0;
      const newToken = await getAccessToken();
      if (newToken) {
        const retryResponse = await fetch(url, {
          verbose: DEBUG_FETCH,
          headers: { Authorization: `Bearer ${newToken}` },
        });
        if (retryResponse.ok) {
          const data: OpenSkyResponse = await retryResponse.json();
          return enrichWithMetadata(parseOpenSkyStates(data));
        }
      }
    }

    if (!response.ok) {
      console.error(`OpenSky API error: ${response.status}`);
      return [];
    }

    const data: OpenSkyResponse = await response.json();
    return enrichWithMetadata(parseOpenSkyStates(data));
  } catch (error) {
    console.error("Failed to fetch aircraft data:", error);
    return [];
  }
}
