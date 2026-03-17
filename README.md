# Nexus

Real-time aircraft tracking on a 3D globe. Nexus streams live aircraft positions from the OpenSky Network and renders them on an interactive Cesium map with smooth interpolated movement.


### 2D View
https://github.com/user-attachments/assets/66e87dfe-d72e-4d46-8f74-aa5c513f5c78

### 3D View
https://github.com/user-attachments/assets/cbc6f5aa-867a-4a02-a0f1-b99ae5947f64


## Features

- **Live Aircraft Tracking** — Streams real-time aircraft positions via WebSocket with 10-second polling from the OpenSky Network API (OpenSky limits to 4000 credits per day)
- **3D Globe & 2D Map** — Toggle between a 3D globe with terrain and a flat 2D map view. Aircraft render as rotated billboard icons in 2D and 3D models when tracked in 3D.
- **Smooth Interpolation** — Aircraft positions are projected between updates using great-circle dead reckoning, so movement appears fluid at 60fps rather than jumping between poll intervals.
- **Aircraft Sidebar** — Browse all tracked aircraft in a list with type icons (jet, turboprop, helicopter, light). Click any aircraft to select, double click or click the camera icon to follow it on the map.
- **Aircraft Metadata** — Enriches raw ICAO24 codes with aircraft type data from a local database derived from the OpenSky aircraft database.
- **Status Indicators** — Connection state, aircraft count, and last-update timestamp displayed in the sidebar.

## Running locally

Note: OpenSky only allows 4000 credits per day, so I'll need to explore other data sources or add more limits. Until then, this won't be deployed.

You can use your own [OpenSkyNetwork](https://opensky-network.org/) credentials and run locally. Create an account and request credentials (Account > Request Data Access).

Create env file:

```bash
cp .env.example .env
```

Then add the credentials to `.env`.

Install dependencies:

```bash
bun install
```

One-time setup for cached aircraft metadata db:

```bash
# download latest csv (~90mb, okay to delete), then create json cache (required on server)
bun run download-aircraft-db && bun run preprocess-aircraft-db
```

Start a development server:

```bash
bun dev
```

Run for production:

```bash
bun start
```
