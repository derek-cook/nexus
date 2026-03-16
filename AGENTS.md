# Nexus - Real-Time Aircraft Tracking

A real-time aircraft tracking application that displays live aircraft positions on a 3D globe or 2D map. It uses Cesium as the map library, with Resium as a React wrapper. Integrates with OpenSky Network API to fetch aircraft data and streams updates to clients via WebSocket.

## Quick Start

```bash
bun install        # Install dependencies
bun dev            # Start dev server with HMR (localhost:3000)
```

## Tech Stack

- **Runtime**: Bun (not Node.js)
- **Frontend**: React 19, Cesium.js, Resium, Tailwind CSS 4, Radix UI
- **Server**: Bun.serve() with WebSocket support
- **Data Source**: OpenSky Network API (OAuth2)

## Docs

**OpenSky Network REST API** https://openskynetwork.github.io/opensky-api/rest.html#all-state-vectors
**Cesium JS API**: [Cesium.js API](https://cesium.com/learn/cesiumjs/ref-doc/)
**Resium Docs**: [Resium](https://resium.reearth.io/guide)
**Flight Tracker tutorial**: [Flight tracker tutorial](https://cesium.com/learn/cesiumjs-learn/cesiumjs-flight-tracker/)
**Cesium repo**: cloned locally at ../cesium or https://github.com/CesiumGS/cesium
**Cesium gallery examples**: [cesium gallery](https://github.com/CesiumGS/cesium/tree/main/packages/sandcastle/gallery)

## Key Patterns

### WebSocket Channel System

Clients subscribe to named channels (e.g., "aircraft"). Server broadcasts updates to all channel subscribers. See `useWebSocket.ts` for client implementation.

### Aircraft Data Flow

```
OpenSky API → Server polls/caches → WebSocket broadcast → useAircraftUpdates hook → Cesium entities
```

Note: There is a 4000 credit daily limit on OpenSky, each request cost 1-4 credits depending on amount of data requested. ie, requesting aircraft within the lat/lon of a city is 1 credit, but 4 credits for the whole globe.

### Cesium/Resium Viewer Lifecycle

CesiumJS is an imperative geospatial library that centers around the Viewer object. Resium provides the declarative React wrappers.

- Keep state inside child components of `Viewer`.
- Use Resium components when appropriate.
- Prefer imperative viewer updates from child components (`viewer.selectedEntity`, `viewer.trackedEntity`) over lifting this state into `src/components/App.tsx`.
- Keep `src/components/App.tsx` mostly static and focused on composition of `Viewer` children.
- Treat `Viewer` as an imperative root component. Try not to frequently rerender or recreate cesium elements. See cesium property updates below:

#### Property Categories

| Category            | Behavior                           | Example                                          |
| ------------------- | ---------------------------------- | ------------------------------------------------ |
| **Cesium props**    | Mutable, synced on update          | `Entity.position`, `show`                        |
| **Read-only props** | Changing triggers destroy/recreate | `Viewer.sceneMode`, `imageryProvider`            |
| **Cesium events**   | React-style naming                 | `trackedEntityChanged` → `onTrackedEntityChange` |
| **Custom props**    | Resium conveniences                | `Viewer.full`                                    |

Refer to `/ResiumGuide.md` or `https://resium.reearth.io/guide` as a reference for writing cesium components.

## Environment Variables

Copy `.env.example` to `.env` and configure:

- `OPENSKY_CLIENT_ID` - OpenSky OAuth2 client ID
- `OPENSKY_CLIENT_SECRET` - OpenSky OAuth2 client secret

## Testing with mocked data

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
