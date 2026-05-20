import { useEffect } from "react";
import { useCesium } from "resium";

export function CameraConfig() {
  const { viewer } = useCesium();

  useEffect(() => {
    if (!viewer) return;
    const controller = viewer.scene.screenSpaceCameraController;
    controller.zoomFactor = 20.0;
  }, [viewer]);

  return null;
}
