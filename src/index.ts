import { serve, type Server, type ServerWebSocket } from "bun";
import index from "./index.html";

// Type for WebSocket data attached to each connection
interface WebSocketData {
  id: string;
  connectedAt: number;
}

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

    // Serve index.html for all unmatched routes (must be last)
    "/*": index,

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
        },
      });
      if (!upgraded) {
        return new Response("WebSocket upgrade failed", { status: 400 });
      }
    },
  },

  websocket: {
    open(ws: ServerWebSocket<WebSocketData>) {
      console.log(`WebSocket connected: ${ws.data.id}`);
      ws.send(JSON.stringify({ type: "connected", id: ws.data.id }));
    },

    message(ws: ServerWebSocket<WebSocketData>, message: string | Buffer) {
      const text = typeof message === "string" ? message : message.toString();
      console.log(`WebSocket message from ${ws.data.id}: ${text}`);

      // Echo the message back with metadata
      ws.send(
        JSON.stringify({
          type: "message",
          data: text,
          from: ws.data.id,
          timestamp: Date.now(),
        }),
      );
    },

    close(ws: ServerWebSocket<WebSocketData>, code: number, reason: string) {
      console.log(`WebSocket closed: ${ws.data.id} (code: ${code}, reason: ${reason})`);
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
