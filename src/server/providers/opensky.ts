import { enrichWithMetadata } from "./enrich";
import type { AircraftSnapshot, FlightBounds, FlightDataProvider } from "./types";

const DEBUG_FETCH = false;

interface OpenSkyResponse {
  time: number;
  states: (string | number | boolean | null)[][] | null;
}

function parseOpenSkyStates(data: OpenSkyResponse): AircraftSnapshot[] {
  if (!data.states) return [];

  return data.states.map((state) => ({
    icao24: state[0] as string,
    callsign: (state[1] as string)?.trim() || null,
    originCountry: (state[2] as string) ?? null,
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

const OPENSKY_CLIENT_ID = process.env.OPENSKY_CLIENT_ID;
const OPENSKY_CLIENT_SECRET = process.env.OPENSKY_CLIENT_SECRET;
const OPENSKY_TOKEN_URL =
  "https://auth.opensky-network.org/auth/realms/opensky-network/protocol/openid-connect/token";

let accessToken: string | null = null;
let tokenExpiresAt: number = 0;

async function getAccessToken(): Promise<string | null> {
  if (!OPENSKY_CLIENT_ID || !OPENSKY_CLIENT_SECRET) {
    return null;
  }

  if (accessToken && Date.now() < tokenExpiresAt - 3 * 60_000) {
    return accessToken;
  }

  try {
    const response = await fetch(OPENSKY_TOKEN_URL, {
      verbose: DEBUG_FETCH,
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
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
    tokenExpiresAt = Date.now() + (data.expires_in || 1800) * 1000;
    console.log("OpenSky access token refreshed");
    return accessToken;
  } catch (error) {
    console.error("Failed to get OpenSky token:", error);
    return null;
  }
}

async function fetchOpenSky(bounds?: FlightBounds): Promise<AircraftSnapshot[]> {
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

export const openSkyProvider: FlightDataProvider = {
  name: "opensky",
  fetchGlobal: () => fetchOpenSky(),
};
