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
  const subscribedRef = useRef(false);

  // Handle messages and subscribe when connected
  useEffect(() => {
    console.log("useAircraftUpdates effect running", {
      status: ws.status,
      subscribed: subscribedRef.current,
      id: ws.connectionId,
    });

    const unsubscribe = ws.addMessageListener((msg) => {
      console.log("useAircraftUpdates received message", msg.type, {
        subscribed: subscribedRef.current,
      });

      // Subscribe to aircraft channel when we receive the connected message
      if (msg.type === "connected" && !subscribedRef.current) {
        console.log("Subscribing to aircraft channel");
        subscribedRef.current = true;
        ws.subscribe("aircraft");
      }

      // Handle aircraft updates
      const aircraftMsg = msg as AircraftUpdateMessage;
      if (
        aircraftMsg?.channel === "aircraft" &&
        aircraftMsg?.type === "aircraft-update"
      ) {
        console.log("Received aircraft update", aircraftMsg.count);
        setAircraft(aircraftMsg.aircraft);
        setLastUpdate(aircraftMsg.timestamp);
      }
    });

    // If already connected, subscribe immediately
    if (ws.status === "connected" && !subscribedRef.current) {
      console.log("Already connected, subscribing immediately");
      subscribedRef.current = true;
      ws.subscribe("aircraft");
    }

    return () => {
      console.log("useAircraftUpdates effect cleanup");
      unsubscribe();
      subscribedRef.current = false;
    };
  }, [ws.status, ws.subscribe, ws.addMessageListener]);

  return {
    aircraft,
    lastUpdate,
    count: aircraft.length,
    status: ws.status,
    isSubscribed: ws.subscribedChannels.has("aircraft"),
  };
}
