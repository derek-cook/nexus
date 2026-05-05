import type { AircraftSnapshot, FlightCircle } from "./providers";
import { getProvider } from "./providers";
import { REGION_CHANNEL_PREFIX } from "../region-key";

const GLOBAL_POLL_MS = Number(process.env.GLOBAL_POLL_MS) || 120_000;
const TRACK_POLL_MS = Number(process.env.TRACK_POLL_MS) || 2_000;
const REGION_POLL_MS = Number(process.env.REGION_POLL_MS) || 10_000;

export const GLOBAL_CHANNEL = "aircraft:global";
export const TRACK_CHANNEL_PREFIX = "aircraft:track:";
export { REGION_CHANNEL_PREFIX };

export function trackChannelFor(icao24: string): string {
  return `${TRACK_CHANNEL_PREFIX}${icao24.toLowerCase()}`;
}

export function regionChannelFor(key: string): string {
  return `${REGION_CHANNEL_PREFIX}${key}`;
}

type Broadcaster = (channel: string, message: object) => void;

interface PollerState {
  refs: number;
  intervalHandle: ReturnType<typeof setInterval> | null;
  lastSnapshot: AircraftSnapshot[] | null;
  lastTimestamp: number | null;
}

interface TrackPollerState {
  refs: number;
  intervalHandle: ReturnType<typeof setInterval> | null;
  lastSnapshot: AircraftSnapshot | null;
  lastTimestamp: number | null;
}

interface RegionPollerState {
  refs: number;
  intervalHandle: ReturnType<typeof setInterval> | null;
  lastSnapshot: AircraftSnapshot[] | null;
  lastTimestamp: number | null;
  circle: FlightCircle;
}

const globalState: PollerState = {
  refs: 0,
  intervalHandle: null,
  lastSnapshot: null,
  lastTimestamp: null,
};

const trackStates = new Map<string, TrackPollerState>();
const regionStates = new Map<string, RegionPollerState>();

let broadcaster: Broadcaster | null = null;
const globalProvider = getProvider("global");
const trackingProvider = getProvider("tracking");
const regionalProvider = getProvider("regional");

export function setBroadcaster(fn: Broadcaster): void {
  broadcaster = fn;
}

async function pollGlobal(): Promise<void> {
  if (!globalProvider.fetchGlobal) {
    console.error(`Provider ${globalProvider.name} has no fetchGlobal`);
    return;
  }
  try {
    const aircraft = await globalProvider.fetchGlobal();
    if (aircraft.length === 0) return;
    globalState.lastSnapshot = aircraft;
    globalState.lastTimestamp = Date.now();
    if (broadcaster) {
      broadcaster(GLOBAL_CHANNEL, {
        type: "aircraft-update",
        timestamp: globalState.lastTimestamp,
        count: aircraft.length,
        aircraft,
      });
    }
  } catch (err) {
    console.error("Global poll error:", err);
  }
}

export function acquireGlobal(): void {
  globalState.refs++;
  if (globalState.refs === 1 && !globalState.intervalHandle) {
    console.log(
      `Global poller started (every ${GLOBAL_POLL_MS / 1000}s, provider=${globalProvider.name})`
    );
    void pollGlobal();
    globalState.intervalHandle = setInterval(pollGlobal, GLOBAL_POLL_MS);
  }
}

export function releaseGlobal(): void {
  globalState.refs = Math.max(0, globalState.refs - 1);
  if (globalState.refs === 0 && globalState.intervalHandle) {
    clearInterval(globalState.intervalHandle);
    globalState.intervalHandle = null;
    console.log("Global poller stopped (refs=0)");
  }
}

export function getCachedGlobal(): {
  aircraft: AircraftSnapshot[];
  timestamp: number;
} | null {
  if (!globalState.lastSnapshot || !globalState.lastTimestamp) return null;
  return {
    aircraft: globalState.lastSnapshot,
    timestamp: globalState.lastTimestamp,
  };
}

async function pollTrack(icao24: string): Promise<void> {
  if (!trackingProvider.fetchByIcao) {
    console.error(`Provider ${trackingProvider.name} has no fetchByIcao`);
    return;
  }
  const state = trackStates.get(icao24);
  if (!state) return;
  try {
    const snap = await trackingProvider.fetchByIcao(icao24);
    if (!snap) return;
    state.lastSnapshot = snap;
    state.lastTimestamp = Date.now();
    if (broadcaster) {
      broadcaster(trackChannelFor(icao24), {
        type: "track-update",
        timestamp: state.lastTimestamp,
        aircraft: snap,
      });
    }
  } catch (err) {
    console.error(`Track poll error for ${icao24}:`, err);
  }
}

export function acquireTrack(icao24: string): void {
  const key = icao24.toLowerCase();
  let state = trackStates.get(key);
  if (!state) {
    state = {
      refs: 0,
      intervalHandle: null,
      lastSnapshot: null,
      lastTimestamp: null,
    };
    trackStates.set(key, state);
  }
  state.refs++;
  if (state.refs === 1 && !state.intervalHandle) {
    console.log(
      `Track poller started for ${key} (every ${TRACK_POLL_MS / 1000}s, provider=${trackingProvider.name})`
    );
    void pollTrack(key);
    state.intervalHandle = setInterval(() => pollTrack(key), TRACK_POLL_MS);
  }
}

export function releaseTrack(icao24: string): void {
  const key = icao24.toLowerCase();
  const state = trackStates.get(key);
  if (!state) return;
  state.refs = Math.max(0, state.refs - 1);
  if (state.refs === 0 && state.intervalHandle) {
    clearInterval(state.intervalHandle);
    state.intervalHandle = null;
    trackStates.delete(key);
    console.log(`Track poller stopped for ${key} (refs=0)`);
  }
}

export function getCachedTrack(icao24: string): {
  aircraft: AircraftSnapshot;
  timestamp: number;
} | null {
  const state = trackStates.get(icao24.toLowerCase());
  if (!state || !state.lastSnapshot || !state.lastTimestamp) return null;
  return {
    aircraft: state.lastSnapshot,
    timestamp: state.lastTimestamp,
  };
}

async function pollRegion(key: string): Promise<void> {
  if (!regionalProvider.fetchCircle) {
    console.error(`Provider ${regionalProvider.name} has no fetchCircle`);
    return;
  }
  const state = regionStates.get(key);
  if (!state) return;
  try {
    const aircraft = await regionalProvider.fetchCircle(state.circle);
    state.lastSnapshot = aircraft;
    state.lastTimestamp = Date.now();
    if (broadcaster) {
      broadcaster(regionChannelFor(key), {
        type: "region-update",
        timestamp: state.lastTimestamp,
        count: aircraft.length,
        aircraft,
      });
    }
  } catch (err) {
    console.error(`Region poll error for ${key}:`, err);
  }
}

export function acquireRegion(key: string, circle: FlightCircle): void {
  let state = regionStates.get(key);
  if (!state) {
    state = {
      refs: 0,
      intervalHandle: null,
      lastSnapshot: null,
      lastTimestamp: null,
      circle,
    };
    regionStates.set(key, state);
  }
  state.refs++;
  if (state.refs === 1 && !state.intervalHandle) {
    console.log(
      `Region poller started for ${key} (every ${REGION_POLL_MS / 1000}s, provider=${regionalProvider.name})`
    );
    void pollRegion(key);
    state.intervalHandle = setInterval(() => pollRegion(key), REGION_POLL_MS);
  }
}

export function releaseRegion(key: string): void {
  const state = regionStates.get(key);
  if (!state) return;
  state.refs = Math.max(0, state.refs - 1);
  if (state.refs === 0 && state.intervalHandle) {
    clearInterval(state.intervalHandle);
    state.intervalHandle = null;
    regionStates.delete(key);
    console.log(`Region poller stopped for ${key} (refs=0)`);
  }
}

export function getCachedRegion(key: string): {
  aircraft: AircraftSnapshot[];
  timestamp: number;
} | null {
  const state = regionStates.get(key);
  if (!state || !state.lastSnapshot || !state.lastTimestamp) return null;
  return {
    aircraft: state.lastSnapshot,
    timestamp: state.lastTimestamp,
  };
}
