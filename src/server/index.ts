import { serve, type Server, type ServerWebSocket } from "bun";
import index from "../index.html";
import { initAircraftDb } from "./aircraft-db";
import {
  GLOBAL_CHANNEL,
  REGION_CHANNEL_PREFIX,
  TRACK_CHANNEL_PREFIX,
  acquireGlobal,
  acquireRegion,
  acquireTrack,
  getCachedGlobal,
  getCachedRegion,
  getCachedTrack,
  releaseGlobal,
  releaseRegion,
  releaseTrack,
  setBroadcaster,
} from "./aircraft-service";
import type { FlightCircle } from "./providers";

interface WebSocketData {
  id: string;
  connectedAt: number;
  channels: Set<string>;
}

const channelSubscribers = new Map<
  string,
  Set<ServerWebSocket<WebSocketData>>
>();

function broadcastToChannel(channel: string, message: object) {
  const subs = channelSubscribers.get(channel);
  if (!subs || subs.size === 0) return;
  const payload = JSON.stringify({ channel, ...message });
  for (const ws of subs) ws.send(payload);
}

function addToChannel(
  ws: ServerWebSocket<WebSocketData>,
  channel: string
): boolean {
  if (ws.data.channels.has(channel)) return false;
  ws.data.channels.add(channel);
  let subs = channelSubscribers.get(channel);
  if (!subs) {
    subs = new Set();
    channelSubscribers.set(channel, subs);
  }
  subs.add(ws);
  return true;
}

function removeFromChannel(
  ws: ServerWebSocket<WebSocketData>,
  channel: string
): boolean {
  if (!ws.data.channels.has(channel)) return false;
  ws.data.channels.delete(channel);
  const subs = channelSubscribers.get(channel);
  if (subs) {
    subs.delete(ws);
    if (subs.size === 0) channelSubscribers.delete(channel);
  }
  return true;
}

function trackIcaoFromChannel(channel: string): string | null {
  if (!channel.startsWith(TRACK_CHANNEL_PREFIX)) return null;
  const icao = channel.slice(TRACK_CHANNEL_PREFIX.length);
  return /^[0-9a-f]{6}$/i.test(icao) ? icao.toLowerCase() : null;
}

function regionKeyFromChannel(channel: string): string | null {
  if (!channel.startsWith(REGION_CHANNEL_PREFIX)) return null;
  const key = channel.slice(REGION_CHANNEL_PREFIX.length);
  return key.length > 0 ? key : null;
}

function isValidCircle(c: unknown): c is FlightCircle {
  if (!c || typeof c !== "object") return false;
  const obj = c as Record<string, unknown>;
  return (
    typeof obj.lat === "number" &&
    typeof obj.lon === "number" &&
    typeof obj.radiusNm === "number" &&
    Number.isFinite(obj.lat) &&
    Number.isFinite(obj.lon) &&
    Number.isFinite(obj.radiusNm) &&
    obj.radiusNm > 0
  );
}

function acquireChannel(channel: string, circle?: FlightCircle | null): void {
  if (channel === GLOBAL_CHANNEL) {
    acquireGlobal();
    return;
  }
  const icao = trackIcaoFromChannel(channel);
  if (icao) {
    acquireTrack(icao);
    return;
  }
  const regionKey = regionKeyFromChannel(channel);
  if (regionKey && circle) acquireRegion(regionKey, circle);
}

function releaseChannel(channel: string): void {
  if (channel === GLOBAL_CHANNEL) {
    releaseGlobal();
    return;
  }
  const icao = trackIcaoFromChannel(channel);
  if (icao) {
    releaseTrack(icao);
    return;
  }
  const regionKey = regionKeyFromChannel(channel);
  if (regionKey) releaseRegion(regionKey);
}

function buildInitialPayload(channel: string): object | null {
  if (channel === GLOBAL_CHANNEL) {
    const cached = getCachedGlobal();
    if (!cached) return null;
    return {
      type: "aircraft-update",
      timestamp: cached.timestamp,
      count: cached.aircraft.length,
      aircraft: cached.aircraft,
    };
  }
  const icao = trackIcaoFromChannel(channel);
  if (icao) {
    const cached = getCachedTrack(icao);
    if (!cached) return null;
    return {
      type: "track-update",
      timestamp: cached.timestamp,
      aircraft: cached.aircraft,
    };
  }
  const regionKey = regionKeyFromChannel(channel);
  if (regionKey) {
    const cached = getCachedRegion(regionKey);
    if (!cached) return null;
    return {
      type: "region-update",
      timestamp: cached.timestamp,
      count: cached.aircraft.length,
      aircraft: cached.aircraft,
    };
  }
  return null;
}

setBroadcaster(broadcastToChannel);

initAircraftDb().catch((err) =>
  console.warn("Aircraft DB init failed (continuing without it):", err)
);

const server = serve<WebSocketData>({
  routes: {
    // Serve Cesium static assets
    "/cesium/*": async (req: Request) => {
      const url = new URL(req.url);
      const filePath = `./public${url.pathname}`;
      const file = Bun.file(filePath);
      if (await file.exists()) {
        return new Response(file);
      }
      return new Response("Not found", { status: 404 });
    },

    // Serve icon assets
    "/icons/*": async (req: Request) => {
      const url = new URL(req.url);
      const filePath = `./public${url.pathname}`;
      const file = Bun.file(filePath);
      if (await file.exists()) {
        return new Response(file);
      }
      return new Response("Not found", { status: 404 });
    },

    "/api/hello": {
      async GET() {
        return Response.json({
          message: "Hello, world!",
          method: "GET",
        });
      },
      async PUT() {
        return Response.json({
          message: "Hello, world!",
          method: "PUT",
        });
      },
    },

    "/api/hello/:name": async (req: Request & { params: { name: string } }) => {
      const name = req.params.name;
      return Response.json({
        message: `Hello, ${name}!`,
      });
    },

    // WebSocket upgrade endpoint
    "/ws": (req: Request, server: Server<WebSocketData>) => {
      const upgraded = server.upgrade(req, {
        data: {
          id: crypto.randomUUID(),
          connectedAt: Date.now(),
          channels: new Set<string>(),
        },
      });
      if (!upgraded) {
        return new Response("WebSocket upgrade failed", { status: 400 });
      }
    },

    // Serve index.html for all unmatched routes (must be last)
    "/*": index,
  },

  websocket: {
    open(ws: ServerWebSocket<WebSocketData>) {
      console.log(`server WebSocket connected: ${ws.data.id}`);
      ws.send(JSON.stringify({ type: "connected", id: ws.data.id }));
    },

    message(ws: ServerWebSocket<WebSocketData>, message: string | Buffer) {
      const text = typeof message === "string" ? message : message.toString();

      try {
        const msg = JSON.parse(text);

        if (msg.type === "subscribe" && typeof msg.channel === "string") {
          const channel = msg.channel;
          const regionKey = regionKeyFromChannel(channel);
          let circle: FlightCircle | null = null;
          if (regionKey) {
            if (!isValidCircle(msg.circle)) {
              ws.send(
                JSON.stringify({
                  type: "error",
                  error: "subscribe to aircraft:region:<key> requires valid circle",
                })
              );
              return;
            }
            circle = msg.circle;
          }
          const added = addToChannel(ws, channel);
          if (added) acquireChannel(channel, circle);
          ws.send(JSON.stringify({ type: "subscribed", channel }));
          console.log(`Client ${ws.data.id} subscribed to ${channel}`);

          const initial = buildInitialPayload(channel);
          if (initial) {
            ws.send(JSON.stringify({ channel, ...initial }));
          }
          return;
        }

        if (msg.type === "unsubscribe" && typeof msg.channel === "string") {
          const channel = msg.channel;
          const removed = removeFromChannel(ws, channel);
          if (removed) releaseChannel(channel);
          ws.send(JSON.stringify({ type: "unsubscribed", channel }));
          console.log(`Client ${ws.data.id} unsubscribed from ${channel}`);
          return;
        }
      } catch {
        console.log(`Received non-JSON message: ${text}`);
      }

      ws.send(
        JSON.stringify({
          type: "message",
          data: text,
          from: ws.data.id,
          timestamp: Date.now(),
        })
      );
    },

    close(ws: ServerWebSocket<WebSocketData>, code: number, reason: string) {
      // Tear down every channel this client was subscribed to so ref-counted
      // pollers don't leak when clients disconnect without unsubscribing.
      for (const channel of Array.from(ws.data.channels)) {
        if (removeFromChannel(ws, channel)) releaseChannel(channel);
      }
      console.log(
        `server WebSocket closed: ${ws.data.id} (code: ${code}, reason: ${reason})`
      );
    },
  },

  development: process.env.NODE_ENV !== "production" && {
    // Enable browser hot reloading in development
    hmr: true,

    // Echo console logs from the browser to the server
    console: true,
  },
});

console.log(`Server running at ${server.url}`);
console.log(`WebSocket available at ws://localhost:${server.port}/ws`);
