import { Entity, ModelGraphics, useCesium } from "resium";
import * as Cesium from "cesium";
import { HeadingPitchRange } from "cesium";

export function Aircraft() {
  const { viewer } = useCesium();

  const position = Cesium.Cartesian3.fromDegrees(-95.0, 40.0, 10.0);
  const heading = Cesium.Math.toRadians(0);
  const pitch = 0;
  const roll = 0;
  const hpr = new Cesium.HeadingPitchRoll(heading, pitch, roll);
  const orientation = Cesium.Transforms.headingPitchRollQuaternion(
    position,
    hpr
  );

  return (
    viewer && (
      <Entity
        position={position}
        orientation={orientation}
        name="airplane"
        description="Boeing 747"
        onClick={(event, target) => {
          viewer?.flyTo(target.id, {
            duration: 3,
            offset: new HeadingPitchRange(
              heading + Cesium.Math.toRadians(90),
              Cesium.Math.toRadians(-45),
              100
            ),
          });
        }}
      >
        <ModelGraphics
          uri="/cesium/Assets/Cesium_Air.glb"
          maximumScale={20000}
          minimumPixelSize={128}
        />
      </Entity>
    )
  );
}
