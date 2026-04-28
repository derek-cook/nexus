import { enrichWithMetadata } from "./enrich";
import type {
  AircraftSnapshot,
  FlightCircle,
  FlightDataProvider,
} from "./types";

interface AdsbLolAircraft {
  hex: string;
  flight?: string;
  r?: string;
  t?: string;
  alt_baro?: number | "ground";
  alt_geom?: number;
  gs?: number;
  track?: number;
  baro_rate?: number;
  geom_rate?: number;
  squawk?: string;
  category?: string;
  lat?: number;
  lon?: number;
  seen?: number;
  emergency?: string;
}

interface AdsbLolResponse {
  ac: AdsbLolAircraft[];
  msg: string;
  now: number;
  total: number;
  ctime: number;
  ptime: number;
}

const FT_TO_M = 0.3048;
const KT_TO_MPS = 0.514444;
const FPM_TO_MPS = 0.00508;
const BASE = "https://api.adsb.lol/v2";

// Map ADS-B Mode-S emitter category strings (e.g. "A2") to the integer
// numbering used by OpenSky and our local aircraft-db classifyByCategory.
function adsbCategoryToInt(cat: string | undefined): number | null {
  if (!cat || cat.length !== 2) return null;
  const set = cat[0];
  const idx = Number.parseInt(cat[1] ?? "", 10);
  if (Number.isNaN(idx)) return null;
  if (set === "A") {
    if (idx === 0) return 0;
    return idx + 1; // A1=2 (Light), ..., A7=8 (Rotorcraft)
  }
  if (set === "B") {
    if (idx === 0) return 0;
    if (idx >= 1 && idx <= 4) return idx + 8; // glider/LTA/parachutist/ultralight
    if (idx === 6) return 14; // UAV
    if (idx === 7) return 15; // space
  }
  if (set === "C") return 15 + idx; // surface vehicles & obstacles
  return null;
}

function mapAdsbAircraft(
  ac: AdsbLolAircraft,
  responseNow: number
): AircraftSnapshot {
  const onGround = ac.alt_baro === "ground";
  const baroFeet = typeof ac.alt_baro === "number" ? ac.alt_baro : null;
  const geomFeet = typeof ac.alt_geom === "number" ? ac.alt_geom : null;
  const verticalFpm =
    ac.baro_rate !== undefined
      ? ac.baro_rate
      : ac.geom_rate !== undefined
        ? ac.geom_rate
        : null;
  const seenSec = ac.seen ?? 0;
  const lastContact = Math.floor((responseNow - seenSec * 1000) / 1000);

  return {
    icao24: ac.hex.toLowerCase(),
    callsign: ac.flight ? ac.flight.trim() || null : null,
    originCountry: null,
    timePosition: lastContact,
    lastContact,
    longitude: ac.lon ?? null,
    latitude: ac.lat ?? null,
    baroAltitude: baroFeet !== null ? baroFeet * FT_TO_M : null,
    geoAltitude: geomFeet !== null ? geomFeet * FT_TO_M : null,
    onGround,
    velocity: ac.gs !== undefined ? ac.gs * KT_TO_MPS : null,
    trueTrack: ac.track ?? null,
    verticalRate: verticalFpm !== null ? verticalFpm * FPM_TO_MPS : null,
    squawk: ac.squawk ?? null,
    spi: null,
    positionSource: null,
    category: adsbCategoryToInt(ac.category),
    typecode: ac.t || null,
    iconType: "unknown",
  };
}

async function fetchCircle(circle: FlightCircle): Promise<AircraftSnapshot[]> {
  const radius = Math.min(circle.radiusNm, 250);
  const url = `${BASE}/lat/${circle.lat}/lon/${circle.lon}/dist/${radius}`;
  try {
    const response = await fetch(url, {
      headers: { accept: "application/json" },
    });
    if (!response.ok) {
      console.error(`adsb.lol fetchCircle ${response.status}: ${url}`);
      return [];
    }
    const data: AdsbLolResponse = await response.json();
    const mapped = (data.ac ?? []).map((ac) => mapAdsbAircraft(ac, data.now));
    return enrichWithMetadata(mapped);
  } catch (err) {
    console.error("adsb.lol fetchCircle error:", err);
    return [];
  }
}

async function fetchByIcao(icao24: string): Promise<AircraftSnapshot | null> {
  const url = `${BASE}/hex/${icao24.toLowerCase()}`;
  try {
    const response = await fetch(url, {
      headers: { accept: "application/json" },
    });
    if (!response.ok) {
      console.error(`adsb.lol fetchByIcao ${response.status}: ${url}`);
      return null;
    }
    const data: AdsbLolResponse = await response.json();
    const ac = data.ac?.[0];
    if (!ac) return null;
    const snap = mapAdsbAircraft(ac, data.now);
    enrichWithMetadata([snap]);
    return snap;
  } catch (err) {
    console.error("adsb.lol fetchByIcao error:", err);
    return null;
  }
}

export const adsbLolProvider: FlightDataProvider = {
  name: "adsblol",
  fetchCircle,
  fetchByIcao,
};
