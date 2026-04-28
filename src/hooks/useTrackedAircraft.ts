import { useEffect, useState } from "react";
import { useWebSocket } from "./useWebSocket";
import type { AircraftState } from "./useGlobalAircraft";

interface TrackUpdateMessage {
  channel: string;
  type: "track-update";
  timestamp: number;
  aircraft: AircraftState;
}

export function useTrackedAircraft(icao24: string | null) {
  const ws = useWebSocket();
  const [aircraft, setAircraft] = useState<AircraftState | null>(null);
  const [lastUpdate, setLastUpdate] = useState<number | null>(null);

  useEffect(() => {
    if (!icao24) {
      setAircraft(null);
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
        setAircraft(trackMsg.aircraft);
        setLastUpdate(trackMsg.timestamp);
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

  return { aircraft, lastUpdate };
}
