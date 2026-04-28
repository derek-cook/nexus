import { adsbLolProvider } from "./adsblol";
import { openSkyProvider } from "./opensky";
import { mockProvider } from "./mock";
import type { FlightDataProvider, ProviderRole } from "./types";

const providers: Record<string, FlightDataProvider> = {
  adsblol: adsbLolProvider,
  opensky: openSkyProvider,
  mock: mockProvider,
};

const ROLE_DEFAULTS: Record<ProviderRole, string> = {
  global: "opensky",
  regional: "adsblol",
  tracking: "adsblol",
};

export function getProvider(role: ProviderRole): FlightDataProvider {
  const envKey = `FLIGHT_PROVIDER_${role.toUpperCase()}`;
  const requested = process.env[envKey] || ROLE_DEFAULTS[role];
  const provider = providers[requested];
  if (!provider) {
    console.warn(
      `Unknown provider "${requested}" for role ${role}, falling back to mock`
    );
    return mockProvider;
  }
  return provider;
}

export type {
  AircraftSnapshot,
  FlightBounds,
  FlightCircle,
  FlightDataProvider,
  ProviderRole,
} from "./types";
