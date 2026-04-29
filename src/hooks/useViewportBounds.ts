import { useEffect, useState } from "react";
import * as Cesium from "cesium";
import type { RegionCenter } from "../region-key";

// Reads the camera's own lat/lon (positionCartographic) — the point on the
// surface directly under the camera, independent of pitch/yaw. Works in 2D
// and 3D and avoids the computeViewRectangle quirks that return undefined
// after a flyTo.
function readCameraCenter(viewer: Cesium.Viewer): RegionCenter | null {
  const carto = viewer.camera.positionCartographic;
  if (!carto) return null;
  const lat = Cesium.Math.toDegrees(carto.latitude);
  const lon = Cesium.Math.toDegrees(carto.longitude);
  if (!Number.isFinite(lat) || !Number.isFinite(lon)) return null;
  return { lat, lon };
}

export function useViewportBounds(viewer: Cesium.Viewer | undefined) {
  const [center, setCenter] = useState<RegionCenter | null>(null);

  useEffect(() => {
    if (!viewer) return;

    const update = () => {
      try {
        setCenter(readCameraCenter(viewer));
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

  return { center, regionalEnabled: center !== null };
}
