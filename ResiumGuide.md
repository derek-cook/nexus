# Resium Component Guide

Resium wraps CesiumJS in React components. All Resium components must live inside a `<Viewer>` (or `<CesiumWidget>`) root.

Reference: https://resium.reearth.io/guide

## Component Lifecycle

Resium components don't render DOM (except root components). Instead they create/manage Cesium objects imperatively:

1. **Mount** — Cesium element created and added to parent
2. **Update** — Changed props sync to the Cesium element
3. **Unmount** — Cesium element destroyed

Changing a **read-only prop** destroys and recreates the entire element. Wrap read-only values in `useMemo` to prevent unnecessary reinitializations:

```tsx
// BAD: new provider object every render → element recreated each time
<ImageryLayer imageryProvider={new ArcGisMapServerImageryProvider({ url })} />

// GOOD: stable reference, only recreated when url changes
const provider = useMemo(() => new ArcGisMapServerImageryProvider({ url }), [url]);
<ImageryLayer imageryProvider={provider} />
```

## Component Hierarchy

Components use React context to find their parent Cesium element. Place components as **shallow as possible** under the root `<Viewer>`.

```tsx
// GOOD: flat structure
<Viewer>
  <Scene />
  <Globe />
  <Camera />
  <Entity />
  <CameraFlyTo destination={rect} />
</Viewer>

// BAD: unnecessary nesting causes extra render cycles
<Viewer>
  <Scene>
    <Camera>
      <Entity />
    </Camera>
  </Scene>
</Viewer>
```

**Valid parent-child nesting exceptions:**

- `Entity` > `*Graphics` (e.g. `PointGraphics`, `BillboardGraphics`, `ModelGraphics`)
- `Entity` > `EntityDescription`
- `ScreenSpaceEventHandler` > `ScreenSpaceEvent`
- `CustomDataSource` > `Entity`
- `*Collection` > item (e.g. `BillboardCollection` > `Billboard`)

## Property Categories

| Category | Behavior | Example |
|---|---|---|
| **Cesium props** | Mutable, synced on update | `Entity.position`, `show` |
| **Read-only props** | Changing triggers destroy/recreate | `Viewer.sceneMode`, `imageryProvider` |
| **Cesium events** | React-style naming | `trackedEntityChanged` → `onTrackedEntityChange` |
| **Custom props** | Resium conveniences | `Viewer.full` |

## Accessing the Viewer Imperatively

### Option 1

Use `useCesium` inside any component mounted under `<Viewer>`:

### Option 2

Pass a ref to that component and access the underlying Cesium object via `ref.current.cesiumElement`.

## Entity & Graphics

`Entity` is the primary way to display geographic data. Attach graphics type to entity:

```tsx
// Option A: graphics as child component (preferred — efficient prop updates)
<Entity position={position} name="Tokyo">
  <PointGraphics pixelSize={10} color={Color.YELLOW} />
</Entity>

// Option B: graphics as constructor options (simpler but recreates on any change)
<Entity
  position={position}
  name="Tokyo"
  point={{ pixelSize: 10, color: Color.YELLOW }}
/>
```

### Available Graphics components

`PointGraphics`, `BillboardGraphics`, `LabelGraphics`, `ModelGraphics`, `PolygonGraphics`, `PolylineGraphics`, `BoxGraphics`, `CylinderGraphics`, `EllipseGraphics`, `EllipsoidGraphics`, `RectangleGraphics`, `WallGraphics`, `CorridorGraphics`, `PathGraphics`, `PlaneGraphics`, `PolylineVolumeGraphics`

### EntityDescription

Renders React children into the Cesium info box via a portal:

```tsx
<Entity position={pos}>
  <EntityDescription>
    <h1>Custom HTML description</h1>
    <p>Rendered as React portal into the info box</p>
  </EntityDescription>
</Entity>
```

## Camera Operations

Camera components execute on mount. Use the `once` prop to run only once:

```tsx
<CameraFlyTo destination={rectangle} duration={2} once />
<CameraFlyHome duration={1} />
<CameraLookAt target={position} offset={new HeadingPitchRange(0, -Math.PI/4, 1000)} />
```

Alternatively, use `useCesium` and call functions on `viewer.camera`.

## Data Sources

Load external data formats declaratively:

```tsx
<CzmlDataSource data="path/to/data.czml" />
<GeoJsonDataSource data="path/to/data.geojson" />
<KmlDataSource data="path/to/data.kml" />
<CustomDataSource name="my-source">
  <Entity position={pos} point={{ pixelSize: 10 }} />
</CustomDataSource>
```

Data source components support mouse/touch event handlers: `onClick`, `onDoubleClick`, `onMouseMove`, `onMouseEnter`, `onMouseLeave`.

## Primitives (Performance Path)

Use primitive collections when Entity performance is insufficient (hundreds/thousands of objects):

```tsx
<BillboardCollection>
  <Billboard position={pos1} image={url} />
  <Billboard position={pos2} image={url} />
</BillboardCollection>

<PointPrimitiveCollection>
  <PointPrimitive position={pos} color={Color.RED} pixelSize={8} />
</PointPrimitiveCollection>
```

Primitive items support mouse/touch events directly. Entity graphics do **not** — handle interaction at the data source or use `ScreenSpaceEvent`.

## Event Handling

```tsx
<ScreenSpaceEventHandler>
  <ScreenSpaceEvent
    type={ScreenSpaceEventType.LEFT_CLICK}
    action={(e) => {
      const picked = viewer.scene.pick(e.position);
      // picked?.id for entities, picked?.primitive for primitives
    }}
  />
</ScreenSpaceEventHandler>
```

## Imagery Layers

Layers render in JSX order (last = frontmost):

```tsx
<ImageryLayerCollection>
  <ImageryLayer imageryProvider={baseProvider} />
  <ImageryLayer imageryProvider={overlayProvider} alpha={0.5} />
</ImageryLayerCollection>
```

## 3D Tiles

```tsx
<Cesium3DTileset
  url={tilesetUrl}
  onReady={(tileset) => viewer.zoomTo(tileset)}
  maximumScreenSpaceError={16}
/>
```

## Environment & Post-Processing

```tsx
<Viewer>
  <Fog enabled density={0.001} />
  <Sun show />
  <SkyAtmosphere show brightnessShift={0.2} />
  <PostProcessStage fragmentShader={myShader} enabled />
</Viewer>
```

## Import Rules

```tsx
// CORRECT
import { Cartesian3, Color } from "cesium";
import * as Cesium from "cesium";

// WRONG: cesium has no default export
import Cesium from "cesium";
```

## Limitations

- No server-side rendering (Cesium requires DOM, WebGL, Web Workers)
- No React Native support