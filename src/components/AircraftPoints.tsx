import { useEffect, useRef } from "react";
import { useCesium } from "resium";
import * as Cesium from "cesium";
import { useAircraftUpdates } from "../hooks/useAircraftUpdates";

export function AircraftPoints() {
  const { aircraft } = useAircraftUpdates();

  const { viewer } = useCesium();
  const entityIdsRef = useRef<Set<string>>(new Set());

  useEffect(() => {
    if (!viewer) return;

    const currentIds = new Set<string>();
    viewer.entities.suspendEvents();

    // Create or update entities for each aircraft
    for (const ac of aircraft) {
      // Skip aircraft without valid position
      if (ac.longitude === null || ac.latitude === null) continue;

      const id = `aircraft-${ac.icao24}`;
      currentIds.add(id);

      // Use geoAltitude if available, otherwise baroAltitude, default to 0m
      const altitude = ac.geoAltitude ?? ac.baroAltitude ?? 0;
      const position = Cesium.Cartesian3.fromDegrees(
        ac.longitude,
        ac.latitude,
        altitude
      );

      const entity = viewer.entities.getOrCreateEntity(id);

      // Update entity properties
      entity.name = ac.callsign || ac.icao24;
      entity.position = new Cesium.ConstantPositionProperty(position);
      entity.description = new Cesium.ConstantProperty(
        `<pre>${JSON.stringify(ac, null, 2)}</pre>`
      );
      entity.point = new Cesium.PointGraphics({
        pixelSize: 8,
        color: ac.onGround ? Cesium.Color.GRAY : Cesium.Color.YELLOW,
        outlineColor: Cesium.Color.BLACK,
        outlineWidth: 1,
      });
    }

    // Remove entities for aircraft no longer in the list
    for (const oldId of entityIdsRef.current) {
      if (!currentIds.has(oldId)) {
        const entity = viewer.entities.getById(oldId);
        if (entity) {
          viewer.entities.remove(entity);
        }
      }
    }

    viewer.entities.resumeEvents();

    entityIdsRef.current = currentIds;
  }, [viewer, aircraft]);

  return null;
}
