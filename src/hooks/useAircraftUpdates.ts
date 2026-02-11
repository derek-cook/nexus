import { useEffect, useState, useRef } from "react";
import { useWebSocket } from "./useWebSocket";

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
}

interface AircraftUpdateMessage {
  channel: "aircraft";
  type: "aircraft-update";
  timestamp: number;
  count: number;
  aircraft: AircraftState[];
}

export function useAircraftUpdates() {
  const ws = useWebSocket();
  const [aircraft, setAircraft] = useState<AircraftState[]>([]);
  const [lastUpdate, setLastUpdate] = useState<number | null>(null);

  // Handle messages and subscribe when connected
  useEffect(() => {
    const unsubscribe = ws.addMessageListener((msg) => {
      // Subscribe to aircraft channel when we receive the connected message
      if (msg.type === "connected") {
        ws.subscribe("aircraft");
      }

      // Handle aircraft updates
      const aircraftMsg = msg as AircraftUpdateMessage;
      if (
        aircraftMsg?.channel === "aircraft" &&
        aircraftMsg?.type === "aircraft-update"
      ) {
        setAircraft(aircraftMsg.aircraft);
        setLastUpdate(aircraftMsg.timestamp);
      }
    });

    return () => {
      unsubscribe();
    };
  }, [ws.subscribe, ws.addMessageListener]);

  return {
    aircraft,
    lastUpdate,
    count: aircraft.length,
    status: ws.status,
    isSubscribed: ws.subscribedChannels.has("aircraft"),
  };
}
