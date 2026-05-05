import { useEffect, useRef, useState } from "react";
import { useWebSocket } from "./useWebSocket";
import type { AircraftState } from "./useGlobalAircraft";
import { aircraftInterpolation } from "../lib/aircraftInterpolation";

interface TrackUpdateMessage {
  channel: string;
  type: "track-update";
  timestamp: number;
  aircraft: AircraftState;
}

interface Options {
  onUpdate?: (fix: AircraftState, timestamp: number) => void;
}

// Thin transport: subscribe to a per-icao high-cadence track channel and
// push each fix into the interpolation service. The tracked entity reads
// interpolated positions via CallbackPositionProperty at 60 fps, so we
// don't need to imperatively touch the entity here — refreshing the
// baseline is enough.
export function useTrackedAircraft(
  icao24: string | null,
  { onUpdate }: Options = {}
) {
  const ws = useWebSocket();
  const [lastUpdate, setLastUpdate] = useState<number | null>(null);

  const onUpdateRef = useRef(onUpdate);
  useEffect(() => {
    onUpdateRef.current = onUpdate;
  }, [onUpdate]);

  useEffect(() => {
    if (!icao24) {
      setLastUpdate(null);
      return;
    }
    const channel = `aircraft:track:${icao24.toLowerCase()}`;

    const removeListener = ws.addMessageListener((msg) => {
      const trackMsg = msg as unknown as TrackUpdateMessage;
      if (
        trackMsg?.channel === channel &&
        trackMsg?.type === "track-update"
      ) {
        aircraftInterpolation.updateFromFix(
          [trackMsg.aircraft],
          trackMsg.timestamp,
          { removeMissing: false }
        );
        setLastUpdate(trackMsg.timestamp);
        onUpdateRef.current?.(trackMsg.aircraft, trackMsg.timestamp);
      }
    });

    if (ws.status === "connected") {
      ws.subscribe(channel);
    }

    return () => {
      if (ws.status === "connected") ws.unsubscribe(channel);
      removeListener();
    };
  }, [
    icao24,
    ws.status,
    ws.subscribe,
    ws.unsubscribe,
    ws.addMessageListener,
  ]);

  const channel = icao24 ? `aircraft:track:${icao24.toLowerCase()}` : null;

  return {
    lastUpdate,
    status: ws.status,
    isSubscribed: channel ? ws.subscribedChannels.has(channel) : false,
  };
}
