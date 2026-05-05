import { useEffect, useRef, useState } from "react";
import { useWebSocket } from "./useWebSocket";
import type { AircraftState } from "./useGlobalAircraft";
import { aircraftInterpolation } from "../lib/aircraftInterpolation";
import { snapCenter, type RegionCenter } from "../region-key";

interface RegionUpdateMessage {
  channel: string;
  type: "region-update";
  timestamp: number;
  count: number;
  aircraft: AircraftState[];
}

const RESUB_DEBOUNCE_MS = 500;

interface Options {
  onBatch?: (fixes: AircraftState[], timestamp: number) => void;
}

// Thin transport: subscribe to the snapped regional channel, push fixes into
// the interpolation service (additive — never removes), then fire onBatch.
// The viewport-driven snapping logic stays here so the entity manager doesn't
// have to know about region keys.
export function useRegionalAircraft(
  center: RegionCenter | null,
  enabled: boolean,
  { onBatch }: Options = {}
) {
  const ws = useWebSocket();
  const [aircraft, setAircraft] = useState<AircraftState[]>([]);
  const [lastUpdate, setLastUpdate] = useState<number | null>(null);
  const currentChannelRef = useRef<string | null>(null);

  const onBatchRef = useRef(onBatch);
  useEffect(() => {
    onBatchRef.current = onBatch;
  }, [onBatch]);

  // Filter region-update messages onto whatever channel is currently active.
  useEffect(() => {
    return ws.addMessageListener((msg) => {
      const regionMsg = msg as unknown as RegionUpdateMessage;
      if (
        regionMsg?.type === "region-update" &&
        regionMsg?.channel === currentChannelRef.current
      ) {
        aircraftInterpolation.updateFromFix(
          regionMsg.aircraft,
          regionMsg.timestamp,
          { removeMissing: false }
        );
        setAircraft(regionMsg.aircraft);
        setLastUpdate(regionMsg.timestamp);
        onBatchRef.current?.(regionMsg.aircraft, regionMsg.timestamp);
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
