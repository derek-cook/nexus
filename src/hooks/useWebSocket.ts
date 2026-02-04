import { useEffect, useRef, useState, useCallback } from "react";

export interface WebSocketMessage {
  type: string;
  channel?: string;
  data?: string;
  id?: string;
  from?: string;
  timestamp?: number;
}

export type WebSocketStatus = "connecting" | "connected" | "disconnected";
export type MessageListener = (message: WebSocketMessage) => void;

export function useWebSocket(url: string = `ws://${window.location.host}/ws`) {
  const wsRef = useRef<WebSocket | null>(null);
  const listenersRef = useRef<Set<MessageListener>>(new Set());
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

    // Set ref immediately so handlers can access it
    wsRef.current = ws;

    ws.onopen = (e) => {
      console.log("client websocket opened", e);
    };

    ws.onmessage = (event) => {
      console.log("client websocket message");
      // Ignore messages if this WebSocket is no longer current (e.g., React Strict Mode cleanup)
      if (wsRef.current !== ws) {
        return;
      }

      try {
        const message = JSON.parse(event.data);
        setLastMessage(message);

        // Notify all listeners
        for (const listener of listenersRef.current) {
          listener(message);
        }

        if (message.type === "connected" && message.id) {
          setStatus("connected");
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
        console.error("Error parsing message", event.data);
        const rawMessage = { type: "raw", data: event.data };
        setLastMessage(rawMessage);
        for (const listener of listenersRef.current) {
          listener(rawMessage);
        }
      }
    };

    ws.onclose = () => {
      console.log("client websocket closed", connectionId);
      // Only update state if this is still the current WebSocket
      if (wsRef.current === ws) {
        setStatus("disconnected");
        setConnectionId(null);
        setSubscribedChannels(new Set());
        wsRef.current = null;
      }
    };

    ws.onerror = () => {
      if (wsRef.current === ws) {
        setStatus("disconnected");
      }
    };
  }, [url]);

  const disconnect = useCallback(() => {
    wsRef.current?.close();
    wsRef.current = null;
  }, []);

  const send = useCallback((data: string | object) => {
    const ws = wsRef.current;
    if (ws?.readyState === WebSocket.OPEN) {
      const message = typeof data === "string" ? data : JSON.stringify(data);
      ws.send(message);
    } else {
      console.error("send failed: WebSocket not open", {
        wsExists: ws,
        readyState: ws?.readyState,
      });
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

  const addMessageListener = useCallback((listener: MessageListener) => {
    listenersRef.current.add(listener);
    return () => {
      listenersRef.current.delete(listener);
    };
  }, []);

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
    addMessageListener,
    connect,
    disconnect,
  };
}
