import { useEffect, useRef, useState } from "react";
import { useWebSocket } from "./useWebSocket";
import { aircraftInterpolation } from "../lib/aircraftInterpolation";

export interface AircraftState {
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
  typecode: string | null;
  iconType: string;
}

interface AircraftUpdateMessage {
  channel: "aircraft:global";
  type: "aircraft-update";
  timestamp: number;
  count: number;
  aircraft: AircraftState[];
}

const GLOBAL_CHANNEL = "aircraft:global";

interface Options {
  onBatch?: (fixes: AircraftState[], timestamp: number) => void;
}

// Thin transport: subscribe to the global channel, push fixes straight into
// the interpolation service (canonical worldwide snapshot — owns removal),
// and fire onBatch so the entity manager can update Cesium imperatively.
// No bulk aircraft array in React state.
export function useGlobalAircraft({ onBatch }: Options = {}) {
  const ws = useWebSocket();
  const [lastUpdate, setLastUpdate] = useState<number | null>(null);

  const onBatchRef = useRef(onBatch);
  useEffect(() => {
    onBatchRef.current = onBatch;
  }, [onBatch]);

  useEffect(() => {
    const removeListener = ws.addMessageListener((msg) => {
      const aircraftMsg = msg as unknown as AircraftUpdateMessage;
      if (
        aircraftMsg?.channel === GLOBAL_CHANNEL &&
        aircraftMsg?.type === "aircraft-update"
      ) {
        aircraftInterpolation.updateFromFix(
          aircraftMsg.aircraft,
          aircraftMsg.timestamp,
          { removeMissing: true }
        );
        setLastUpdate(aircraftMsg.timestamp);
        onBatchRef.current?.(aircraftMsg.aircraft, aircraftMsg.timestamp);
      }
    });

    if (ws.status === "connected") {
      ws.subscribe(GLOBAL_CHANNEL);
    }

    return () => {
      removeListener();
      if (ws.status === "connected") ws.unsubscribe(GLOBAL_CHANNEL);
    };
  }, [ws.status, ws.subscribe, ws.unsubscribe, ws.addMessageListener]);

  return {
    lastUpdate,
    status: ws.status,
    isSubscribed: ws.subscribedChannels.has(GLOBAL_CHANNEL),
  };
}
