/**
 * Bridge hook connecting WebSocket aircraft data to the interpolation service.
 * Updates baselines when new fixes arrive and exposes the interpolation service.
 */

import { useEffect } from "react";
import { useAircraftUpdates } from "./useAircraftUpdates";
import { aircraftInterpolation } from "../lib/aircraftInterpolation";

export function useInterpolatedAircraft() {
  const { aircraft, lastUpdate, count, status, isSubscribed } =
    useAircraftUpdates();

  // Update interpolation baselines when new data arrives
  useEffect(() => {
    if (aircraft.length > 0 && lastUpdate !== null) {
      aircraftInterpolation.updateFromFix(aircraft, lastUpdate);
    }
  }, [aircraft, lastUpdate]);

  return {
    aircraft,
    lastUpdate,
    count,
    status,
    isSubscribed,
    interpolation: aircraftInterpolation,
  };
}
