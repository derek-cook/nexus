import { Viewer, CameraFlyTo, RectangleGraphics, Entity } from "resium";
import * as Cesium from "cesium";
import { AircraftPoints } from "./AircraftPoints";

const LAX_LON = -118.4079;
const LAX_LAT = 33.9416;
const LAX_RECT = Cesium.Rectangle.fromDegrees(
  LAX_LON - 2,
  LAX_LAT - 2,
  LAX_LON + 2,
  LAX_LAT + 2
);

export function App() {
  return (
    <div className="relative h-screen w-screen overflow-hidden">
      <Viewer
        full
        shouldAnimate={true}
        sceneMode={Cesium.SceneMode.SCENE2D}
      >
        <Entity>
          <RectangleGraphics
            coordinates={LAX_RECT}
            material={Cesium.Color.WHITE.withAlpha(0.1)}
            outline
            outlineColor={Cesium.Color.WHITE}
            outlineWidth={3}
            height={0}
          />
        </Entity>
        <AircraftPoints />
        <CameraFlyTo destination={LAX_RECT} />
      </Viewer>
    </div>
  );
}

export default App;
