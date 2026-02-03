import { useEffect, useRef, useState, useCallback } from "react";

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

export interface AircraftUpdateMessage {
  channel: "aircraft";
  type: "aircraft-update";
  timestamp: number;
  count: number;
  aircraft: AircraftState[];
}

export interface WebSocketMessage {
  type: string;
  channel?: string;
  data?: string;
  id?: string;
  from?: string;
  timestamp?: number;
}

export type WebSocketStatus = "connecting" | "connected" | "disconnected";

export function useWebSocket(url: string = `ws://${window.location.host}/ws`) {
  const wsRef = useRef<WebSocket | null>(null);
  const [status, setStatus] = useState<WebSocketStatus>("disconnected");
  const [lastMessage, setLastMessage] = useState<WebSocketMessage | null>(null);
  const [connectionId, setConnectionId] = useState<string | null>(null);
  const [subscribedChannels, setSubscribedChannels] = useState<Set<string>>(
    new Set()
  );

  const connect = useCallback(() => {
    if (wsRef.current?.readyState === WebSocket.OPEN) return;

    setStatus("connecting");
    const ws = new WebSocket(url);

    ws.onopen = () => {
      setStatus("connected");
    };

    ws.onmessage = (event) => {
      try {
        const message = JSON.parse(event.data);
        setLastMessage(message);

        if (message.type === "connected" && message.id) {
          setConnectionId(message.id);
        }

        if (message.type === "subscribed" && message.channel) {
          setSubscribedChannels((prev) => new Set(prev).add(message.channel));
        }

        if (message.type === "unsubscribed" && message.channel) {
          setSubscribedChannels((prev) => {
            const next = new Set(prev);
            next.delete(message.channel);
            return next;
          });
        }
      } catch {
        setLastMessage({ type: "raw", data: event.data });
      }
    };

    ws.onclose = () => {
      setStatus("disconnected");
      setConnectionId(null);
      setSubscribedChannels(new Set());
      wsRef.current = null;
    };

    ws.onerror = () => {
      setStatus("disconnected");
    };

    wsRef.current = ws;
  }, [url]);

  const disconnect = useCallback(() => {
    wsRef.current?.close();
    wsRef.current = null;
  }, []);

  const send = useCallback((data: string | object) => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      const message = typeof data === "string" ? data : JSON.stringify(data);
      wsRef.current.send(message);
    }
  }, []);

  const subscribe = useCallback(
    (channel: string) => {
      send({ type: "subscribe", channel });
    },
    [send]
  );

  const unsubscribe = useCallback(
    (channel: string) => {
      send({ type: "unsubscribe", channel });
    },
    [send]
  );

  useEffect(() => {
    connect();
    return () => disconnect();
  }, [connect, disconnect]);

  return {
    status,
    lastMessage,
    connectionId,
    subscribedChannels,
    send,
    subscribe,
    unsubscribe,
    connect,
    disconnect,
  };
}

// Convenience hook for aircraft updates
export function useAircraftUpdates() {
  const ws = useWebSocket();
  const [aircraft, setAircraft] = useState<AircraftState[]>([]);
  const [lastUpdate, setLastUpdate] = useState<number | null>(null);

  // Subscribe to aircraft channel when connected
  useEffect(() => {
    if (ws.status === "connected" && !ws.subscribedChannels.has("aircraft")) {
      ws.subscribe("aircraft");
    }
  }, [ws.status, ws.subscribedChannels, ws.subscribe]);

  // Handle aircraft update messages
  useEffect(() => {
    const msg = ws.lastMessage as AircraftUpdateMessage | null;
    if (msg?.channel === "aircraft" && msg?.type === "aircraft-update") {
      setAircraft(msg.aircraft);
      setLastUpdate(msg.timestamp);
      console.log({ aircraft: msg.aircraft });
    }
  }, [ws.lastMessage]);

  return {
    aircraft,
    lastUpdate,
    count: aircraft.length,
    status: ws.status,
    isSubscribed: ws.subscribedChannels.has("aircraft"),
  };
}
