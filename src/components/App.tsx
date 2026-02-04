import { Viewer, Entity, RectangleGraphics, CameraFlyTo } from "resium";
import * as Cesium from "cesium";
import { AircraftPoints } from "./AircraftPoints";

// LA metro area bounding box
const LA_BOUNDS = Cesium.Rectangle.fromDegrees(
  -118.7, // West
  33.5, // South
  -117.4, // East
  34.4 // North
);

const terrainProvider = Cesium.createWorldTerrainAsync();

export function App() {
  return (
    <Viewer
      full
      shouldAnimate={true}
      baseLayerPicker={false}
      terrainProvider={terrainProvider}
    >
      <AircraftPoints />
      <CameraFlyTo destination={LA_BOUNDS} />
    </Viewer>
  );
}

export default App;
