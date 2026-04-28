import { useEffect, useState } from "react";
import * as Cesium from "cesium";
import type { RegionBounds } from "../region-key";

// Camera heights below this threshold trigger regional polling. Above it,
// the viewport is too wide for the regional layer to be useful and the
// global poll alone covers it.
const REGIONAL_HEIGHT_THRESHOLD_M = 1_500_000;

export function useViewportBounds(viewer: Cesium.Viewer | undefined) {
  const [bounds, setBounds] = useState<RegionBounds | null>(null);
  const [height, setHeight] = useState<number | null>(null);

  useEffect(() => {
    if (!viewer) return;

    const update = () => {
      try {
        const rect = viewer.camera.computeViewRectangle();
        if (rect) {
          setBounds({
            lamin: Cesium.Math.toDegrees(rect.south),
            lamax: Cesium.Math.toDegrees(rect.north),
            lomin: Cesium.Math.toDegrees(rect.west),
            lomax: Cesium.Math.toDegrees(rect.east),
          });
        } else {
          setBounds(null);
        }
        const positionCarto = viewer.camera.positionCartographic;
        setHeight(positionCarto ? positionCarto.height : null);
      } catch {
        // Camera state is invalid during scene mode morphs; ignore.
      }
    };

    viewer.camera.moveEnd.addEventListener(update);
    update();

    return () => {
      viewer.camera.moveEnd.removeEventListener(update);
    };
  }, [viewer]);

  const regionalEnabled =
    height !== null && height <= REGIONAL_HEIGHT_THRESHOLD_M;

  return { bounds, height, regionalEnabled };
}
