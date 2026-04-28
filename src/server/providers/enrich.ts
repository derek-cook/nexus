import { getAircraftMeta, classifyByCategory } from "../aircraft-db";
import type { AircraftSnapshot } from "./types";

// Mutates each snapshot in place: fills typecode + iconType from the local
// aircraft DB when available, otherwise falls back to ADS-B emitter category
// classification. Provider-agnostic.
export function enrichWithMetadata(
  states: AircraftSnapshot[]
): AircraftSnapshot[] {
  for (const state of states) {
    const meta = getAircraftMeta(state.icao24);
    if (meta) {
      state.typecode = meta.typecode || state.typecode || null;
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
