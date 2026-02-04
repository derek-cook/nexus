import { Viewer, Entity, RectangleGraphics, CameraFlyTo } from "resium";
import * as Cesium from "cesium";
import { AircraftPoints } from "./AircraftPoints";
import { Aircraft } from "./Aircraft";

// LA metro area bounding box
const LA_BOUNDS = Cesium.Rectangle.fromDegrees(
  -118.7, // West
  33.5, // South
  -117.4, // East
  34.4 // North
);

export function App() {
  return (
    <Viewer
      full
      shouldAnimate={true}
      baseLayerPicker={false}
    >
      <AircraftPoints />
      <Aircraft />
      <CameraFlyTo destination={LA_BOUNDS} />
      <Entity
        id="la-metro-area"
        name="LA Metro Area"
      >
        <RectangleGraphics
          coordinates={LA_BOUNDS}
          material={Cesium.Color.BLUE.withAlpha(0.2)}
          outline
          outlineColor={Cesium.Color.BLUE}
          outlineWidth={2}
        />
      </Entity>
    </Viewer>
  );
}

export default App;
