# Nexus - Real-Time Aircraft Tracking

A real-time aircraft tracking application that displays live aircraft positions on a 3D Cesium globe. Integrates with OpenSky Network API to fetch aircraft data and streams updates to clients via WebSocket.

## Quick Start

```bash
bun install        # Install dependencies
bun dev            # Start dev server with HMR (localhost:3000)
```

## Project Structure

```
src/
├── server/
│   ├── index.ts           # Main Bun.serve() entry point with WebSocket
│   ├── aircraft.ts        # OpenSky API integration (real data)
│   └── aircraft-mock.ts   # Mock aircraft data for testing
├── components/
│   ├── App.tsx            # Root React component with Cesium Viewer
│   ├── AircraftPoints.tsx # Aircraft entity rendering
│   └── ui/                # Shadcn-style UI components
├── hooks/
│   ├── useWebSocket.ts        # WebSocket client connection
│   └── useAircraftUpdates.ts  # Aircraft data state management
├── frontend.tsx           # React entry point
├── index.html             # HTML template
└── index.css              # Global styles with Tailwind
```

## Tech Stack

- **Runtime**: Bun (not Node.js)
- **Frontend**: React 19, Cesium.js, Resium, Tailwind CSS 4, Radix UI
- **Server**: Bun.serve() with WebSocket support
- **Data Source**: OpenSky Network API (OAuth2)

**OpenSky Network REST API** https://openskynetwork.github.io/opensky-api/rest.html#all-state-vectors
**Cesium API Docs**: [Cesium.js API](https://cesium.com/learn/cesiumjs/ref-doc/)
**Flight Tracker tutorial**: [Flight tracker tutorial](https://cesium.com/learn/cesiumjs-learn/cesiumjs-flight-tracker/)
**Cesium repo**: cloned locally at ../cesium or https://github.com/CesiumGS/cesium

## Key Patterns

### WebSocket Channel System

Clients subscribe to named channels (e.g., "aircraft"). Server broadcasts updates to all channel subscribers. See `useWebSocket.ts` for client implementation.

### Aircraft Data Flow

```
OpenSky API → Server polls/caches → WebSocket broadcast → useAircraftUpdates hook → Cesium entities
```

### Cesium Rendering

Aircraft rendered as Cesium Entities with:

- 3D model (`Cesium_Air.glb`) with heading orientation
- Point graphics (yellow=airborne, gray=ground)
- Interactive description popups

## Environment Variables

Copy `.env.example` to `.env` and configure:

- `OPENSKY_CLIENT_ID` - OpenSky OAuth2 client ID
- `OPENSKY_CLIENT_SECRET` - OpenSky OAuth2 client secret

## Switching Data Sources

In `src/server/index.ts`, change the import to switch between real and mock data:

```ts
import { subscribeToAircraft } from "./aircraft"; // Real OpenSky data
import { subscribeToAircraft } from "./aircraft-mock"; // Mock data
```

---

## Bun Guidelines

Default to using Bun instead of Node.js.

- Use `bun <file>` instead of `node <file>` or `ts-node <file>`
- Use `bun test` instead of `jest` or `vitest`
- Use `bun build` instead of `webpack` or `esbuild`
- Use `bun install` instead of `npm install`
- Use `bun run <script>` instead of `npm run <script>`
- Bun automatically loads `.env`, so don't use dotenv

### Bun APIs

- `Bun.serve()` for HTTP/WebSocket server (not Express)
- `bun:sqlite` for SQLite (not better-sqlite3)
- `Bun.redis` for Redis (not ioredis)
- `Bun.sql` for Postgres (not pg)
- Built-in `WebSocket` (not ws package)
- `Bun.file` over node:fs readFile/writeFile
- `Bun.$\`cmd\`` instead of execa

For more Bun API details, see `node_modules/bun-types/docs/**.md`.

### Git guidelines

Keep commits atomic: commit only the files you touched and list each path explicitly.
For tracked files run `git commit -m "<scoped message>" -- path/to/file1 path/to/file2`.
For brand-new files, use the one-liner `git restore --staged :/ && git add "path/to/file1" "path/to/file2" && git commit -m "<scoped message>" -- path/to/file1 path/to/file2`
