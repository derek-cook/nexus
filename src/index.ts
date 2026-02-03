import { serve, type Server, type ServerWebSocket } from "bun";
import index from "./index.html";

// Type for WebSocket data attached to each connection
interface WebSocketData {
  id: string;
  connectedAt: number;
  channels: Set<string>;
}

// OpenSky Network API response types
interface OpenSkyState {
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

interface OpenSkyResponse {
  time: number;
  states: (string | number | boolean | null)[][] | null;
}

// Track all connected WebSocket clients
const clients = new Set<ServerWebSocket<WebSocketData>>();

// Parse OpenSky API response into typed objects
function parseOpenSkyStates(data: OpenSkyResponse): OpenSkyState[] {
  if (!data.states) return [];

  return data.states.map((state) => ({
    icao24: state[0] as string,
    callsign: (state[1] as string)?.trim() || null,
    originCountry: state[2] as string,
    timePosition: state[3] as number | null,
    lastContact: state[4] as number,
    longitude: state[5] as number | null,
    latitude: state[6] as number | null,
    baroAltitude: state[7] as number | null,
    onGround: state[8] as boolean,
    velocity: state[9] as number | null,
    trueTrack: state[10] as number | null,
    verticalRate: state[11] as number | null,
    geoAltitude: state[13] as number | null,
    squawk: state[14] as string | null,
  }));
}

// OpenSky credentials from environment
const OPENSKY_USERNAME = process.env.OPENSKY_USERNAME;
const OPENSKY_PASSWORD = process.env.OPENSKY_PASSWORD;

// Fetch aircraft data from OpenSky Network API
async function fetchAircraftData(bounds?: {
  lamin: number;
  lomin: number;
  lamax: number;
  lomax: number;
}): Promise<OpenSkyState[]> {
  try {
    let url = "https://opensky-network.org/api/states/all";

    if (bounds) {
      const params = new URLSearchParams({
        lamin: bounds.lamin.toString(),
        lomin: bounds.lomin.toString(),
        lamax: bounds.lamax.toString(),
        lomax: bounds.lomax.toString(),
      });
      url += `?${params}`;
    }

    const headers: HeadersInit = {};
    if (OPENSKY_USERNAME && OPENSKY_PASSWORD) {
      headers.Authorization =
        "Basic " + btoa(`${OPENSKY_USERNAME}:${OPENSKY_PASSWORD}`);
    }

    const response = await fetch(url, { headers });

    if (!response.ok) {
      console.error(`OpenSky API error: ${response.status}`);
      return [];
    }

    const data: OpenSkyResponse = await response.json();
    return parseOpenSkyStates(data);
  } catch (error) {
    console.error("Failed to fetch aircraft data:", error);
    return [];
  }
}

// Broadcast message to all clients subscribed to a channel
function broadcastToChannel(channel: string, message: object) {
  const payload = JSON.stringify({ channel, ...message });

  for (const client of clients) {
    if (client.data.channels.has(channel)) {
      client.send(payload);
    }
  }
}

// Continental US bounding box
const US_BOUNDS = {
  lamin: 24.5,
  lamax: 49.5,
  lomin: -125,
  lomax: -66,
};

// Poll OpenSky API and broadcast to aircraft channel subscribers
async function pollAircraftUpdates() {
  const aircraft = await fetchAircraftData(US_BOUNDS);

  if (aircraft.length > 0) {
    broadcastToChannel("aircraft", {
      type: "aircraft-update",
      timestamp: Date.now(),
      count: aircraft.length,
      aircraft,
    });
    console.log(`Broadcast ${aircraft.length} aircraft to subscribers`);
  }
}

// Start polling interval
const POLL_INTERVAL_MS = 30_000;
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
      clients.add(ws);
      console.log(`WebSocket connected: ${ws.data.id}`);
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
        `WebSocket closed: ${ws.data.id} (code: ${code}, reason: ${reason})`
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
