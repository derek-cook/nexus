import { useEffect, useRef, useState } from "react";
import { useWebSocket } from "./useWebSocket";
import type { AircraftState } from "./useGlobalAircraft";
import { snapCenter, type RegionCenter } from "../region-key";

interface RegionUpdateMessage {
  channel: string;
  type: "region-update";
  timestamp: number;
  count: number;
  aircraft: AircraftState[];
}

const RESUB_DEBOUNCE_MS = 500;

export function useRegionalAircraft(
  center: RegionCenter | null,
  enabled: boolean
) {
  const ws = useWebSocket();
  const [aircraft, setAircraft] = useState<AircraftState[]>([]);
  const [lastUpdate, setLastUpdate] = useState<number | null>(null);
  const currentChannelRef = useRef<string | null>(null);

  // Filter region-update messages onto whatever channel is currently active.
  useEffect(() => {
    return ws.addMessageListener((msg) => {
      const regionMsg = msg as unknown as RegionUpdateMessage;
      if (
        regionMsg?.type === "region-update" &&
        regionMsg?.channel === currentChannelRef.current
      ) {
        setAircraft(regionMsg.aircraft);
        setLastUpdate(regionMsg.timestamp);
      }
    });
  }, [ws.addMessageListener]);

  // Subscribe / re-subscribe when the snapped channel changes.
  useEffect(() => {
    if (!enabled || !center || ws.status !== "connected") {
      if (currentChannelRef.current) {
        ws.unsubscribe(currentChannelRef.current);
        currentChannelRef.current = null;
        setAircraft([]);
        setLastUpdate(null);
      }
      return;
    }

    const timer = setTimeout(() => {
      const snap = snapCenter(center);
      if (currentChannelRef.current === snap.channel) return;

      if (currentChannelRef.current) {
        ws.unsubscribe(currentChannelRef.current);
      }
      currentChannelRef.current = snap.channel;
      ws.send({
        type: "subscribe",
        channel: snap.channel,
        circle: snap.circle,
      });
    }, RESUB_DEBOUNCE_MS);

    return () => clearTimeout(timer);
  }, [center, enabled, ws.status, ws.send, ws.unsubscribe]);

  useEffect(() => {
    return () => {
      if (currentChannelRef.current) {
        ws.unsubscribe(currentChannelRef.current);
        currentChannelRef.current = null;
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return {
    aircraft,
    lastUpdate,
    currentChannel: currentChannelRef.current,
  };
}
