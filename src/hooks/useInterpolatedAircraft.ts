import { useEffect, useMemo } from "react";
import { useGlobalAircraft, type AircraftState } from "./useGlobalAircraft";
import { useRegionalAircraft } from "./useRegionalAircraft";
import { aircraftInterpolation } from "../lib/aircraftInterpolation";
import type { RegionCenter } from "../region-key";

interface Options {
  regionalCenter: RegionCenter | null;
  regionalEnabled: boolean;
}

// Bridges WebSocket data into the interpolation service. Merges global +
// regional aircraft (regional wins on collisions because it polls 40x faster),
// then feeds the merged set into the interpolation baselines.
export function useInterpolatedAircraft({
  regionalCenter,
  regionalEnabled,
}: Options) {
  const global = useGlobalAircraft();
  const regional = useRegionalAircraft(regionalCenter, regionalEnabled);

  const merged = useMemo<AircraftState[]>(() => {
    const byIcao = new Map<string, AircraftState>();
    for (const ac of global.aircraft) byIcao.set(ac.icao24, ac);
    for (const ac of regional.aircraft) byIcao.set(ac.icao24, ac);
    return Array.from(byIcao.values());
  }, [global.aircraft, regional.aircraft]);

  const lastUpdate = useMemo(() => {
    if (regional.lastUpdate && global.lastUpdate) {
      return Math.max(regional.lastUpdate, global.lastUpdate);
    }
    return regional.lastUpdate ?? global.lastUpdate;
  }, [global.lastUpdate, regional.lastUpdate]);

  useEffect(() => {
    if (merged.length > 0 && lastUpdate !== null) {
      aircraftInterpolation.updateFromFix(merged, lastUpdate);
    }
  }, [merged, lastUpdate]);

  return {
    aircraft: merged,
    globalAircraft: global.aircraft,
    regionalAircraft: regional.aircraft,
    lastUpdate,
    count: merged.length,
    status: global.status,
    isSubscribed: global.isSubscribed,
    regionalChannel: regional.currentChannel,
    interpolation: aircraftInterpolation,
  };
}
