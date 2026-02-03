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

    ws.onopen = (e) => {
      console.log("OPEN", e);
      setStatus("connected");
    };

    ws.onmessage = (event) => {
      try {
        const message = JSON.parse(event.data);
        setLastMessage(message);

        // Notify all listeners
        for (const listener of listenersRef.current) {
          listener(message);
        }

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
        const rawMessage = { type: "raw", data: event.data };
        setLastMessage(rawMessage);
        for (const listener of listenersRef.current) {
          listener(rawMessage);
        }
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
    const ws = wsRef.current;
    console.log("send called", {
      data,
      readyState: ws?.readyState,
      isOpen: ws?.readyState === WebSocket.OPEN,
    });
    if (ws?.readyState === WebSocket.OPEN) {
      const message = typeof data === "string" ? data : JSON.stringify(data);
      ws.send(message);
      console.log("message sent", message);
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
