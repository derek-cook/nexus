import { serve, type Server, type ServerWebSocket } from "bun";
import index from "../index.html";
import { fetchAircraftData, LA_BOUNDS } from "./aircraft";
import { initAircraftDb } from "./aircraft-db";
// import { fetchAircraftData, LA_BOUNDS } from "./aircraft-mock";

// Type for WebSocket data attached to each connection
interface WebSocketData {
  id: string;
  connectedAt: number;
  channels: Set<string>;
}

// Track all connected WebSocket clients
const clients = new Set<ServerWebSocket<WebSocketData>>();

// Broadcast message to all clients subscribed to a channel
function broadcastToChannel(channel: string, message: object) {
  const payload = JSON.stringify({ channel, ...message });
  let clientCount = 0;
  for (const client of clients) {
    if (client.data.channels.has(channel)) {
      client.send(payload);
      clientCount++;
    }
  }
  console.log(`Broadcasted to ${clientCount} clients on channel ${channel}`);
}

function hasSubscribers(channel: string) {
  for (const client of clients) {
    if (client.data.channels.has(channel)) return true;
  }
  return false;
}

// Poll OpenSky API and broadcast to aircraft channel subscribers
async function pollAircraftUpdates() {
  if (!hasSubscribers("aircraft")) return;

  const aircraft = await fetchAircraftData(LA_BOUNDS);

  if (aircraft.length > 0) {
    broadcastToChannel("aircraft", {
      type: "aircraft-update",
      timestamp: Date.now(),
      count: aircraft.length,
      aircraft,
    });
  }
}

// Load aircraft metadata database, then start polling
initAircraftDb().catch((err) =>
  console.warn("Aircraft DB init failed (continuing without it):", err)
);

const POLL_INTERVAL_MS = 10_000;
setInterval(pollAircraftUpdates, POLL_INTERVAL_MS);
console.log(`Aircraft polling started (every ${POLL_INTERVAL_MS / 1000}s)`);

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
      clients.add(ws);
      ws.send(JSON.stringify({ type: "connected", id: ws.data.id }));
    },

    message(ws: ServerWebSocket<WebSocketData>, message: string | Buffer) {
      const text = typeof message === "string" ? message : message.toString();

      try {
        const msg = JSON.parse(text);

        // Handle channel subscriptions
        if (msg.type === "subscribe" && msg.channel) {
          ws.data.channels.add(msg.channel);
          ws.send(
            JSON.stringify({
              type: "subscribed",
              channel: msg.channel,
            })
          );
          console.log(`Client ${ws.data.id} subscribed to ${msg.channel}`);

          // Immediately send aircraft data when subscribing to aircraft channel
          if (msg.channel === "aircraft") {
            fetchAircraftData(LA_BOUNDS).then((aircraft) => {
              if (aircraft.length > 0) {
                ws.send(
                  JSON.stringify({
                    channel: "aircraft",
                    type: "aircraft-update",
                    timestamp: Date.now(),
                    count: aircraft.length,
                    aircraft,
                  })
                );
                console.log(
                  `Sent initial ${aircraft.length} aircraft to client ${ws.data.id}`
                );
              }
            });
          }
          return;
        }

        if (msg.type === "unsubscribe" && msg.channel) {
          ws.data.channels.delete(msg.channel);
          ws.send(
            JSON.stringify({
              type: "unsubscribed",
              channel: msg.channel,
            })
          );
          console.log(`Client ${ws.data.id} unsubscribed from ${msg.channel}`);
          return;
        }
      } catch {
        // Not JSON, treat as regular message
        console.log(`Received non-JSON message: ${text}`);
      }

      // Echo other messages back
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
      clients.delete(ws);
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
