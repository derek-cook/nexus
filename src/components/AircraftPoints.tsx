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

    // Create or update entities for each aircraft
    for (const ac of aircraft) {
      // Skip aircraft without valid position
      if (ac.longitude === null || ac.latitude === null) continue;

      const id = `aircraft-${ac.icao24}`;
      currentIds.add(id);

      // Use geoAltitude if available, otherwise baroAltitude, default to 1000m
      const altitude = ac.geoAltitude ?? ac.baroAltitude ?? 1000;
      const position = Cesium.Cartesian3.fromDegrees(
        ac.longitude,
        ac.latitude,
        altitude
      );

      const entity = viewer.entities.getById(id);

      if (entity) {
        // Update existing entity position
        entity.position = new Cesium.ConstantPositionProperty(position);
        entity.description = new Cesium.ConstantProperty(
          `<pre>${JSON.stringify(ac, null, 2)}</pre>`
        );
      } else {
        // Create new entity
        viewer.entities.add({
          id,
          name: ac.callsign || ac.icao24,
          position,
          point: {
            pixelSize: 8,
            color: ac.onGround ? Cesium.Color.GRAY : Cesium.Color.YELLOW,
            outlineColor: Cesium.Color.BLACK,
            outlineWidth: 1,
          },
          description:
            `Callsign: ${ac.callsign || "N/A"}<br/>` +
            `ICAO24: ${ac.icao24}<br/>` +
            `Altitude: ${altitude?.toFixed(0)}m<br/>` +
            `Velocity: ${ac.velocity?.toFixed(0) || "N/A"} m/s<br/>` +
            `Country: ${ac.originCountry}`,
        });
      }
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

    entityIdsRef.current = currentIds;
  }, [viewer, aircraft]);

  return null;
}
