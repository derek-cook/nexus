import { useEffect, useRef, useState, useCallback } from "react";

export interface WebSocketMessage {
  type: string;
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

  const connect = useCallback(() => {
    if (wsRef.current?.readyState === WebSocket.OPEN) return;

    setStatus("connecting");
    const ws = new WebSocket(url);

    ws.onopen = () => {
      setStatus("connected");
    };

    ws.onmessage = (event) => {
      try {
        const message: WebSocketMessage = JSON.parse(event.data);
        setLastMessage(message);

        if (message.type === "connected" && message.id) {
          setConnectionId(message.id);
        }
      } catch {
        setLastMessage({ type: "raw", data: event.data });
      }
    };

    ws.onclose = () => {
      setStatus("disconnected");
      setConnectionId(null);
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

  useEffect(() => {
    connect();
    return () => disconnect();
  }, [connect, disconnect]);

  return {
    status,
    lastMessage,
    connectionId,
    send,
    connect,
    disconnect,
  };
}
