import { useEffect, useRef } from "react";
import { useCesium } from "resium";
import * as Cesium from "cesium";
import { useInterpolatedAircraft } from "../hooks/useInterpolatedAircraft";

export function AircraftPoints() {
  const { aircraft, interpolation } = useInterpolatedAircraft();

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

      const entity = viewer.entities.getOrCreateEntity(id);

      // Update entity properties
      entity.name = ac.callsign || ac.icao24;
      entity.description = new Cesium.ConstantProperty(
        `<pre>${JSON.stringify(ac, null, 2)}</pre>`
      );
      entity.point = new Cesium.PointGraphics({
        pixelSize: 8,
        color: ac.onGround ? Cesium.Color.GRAY : Cesium.Color.YELLOW,
        outlineColor: Cesium.Color.BLACK,
        outlineWidth: 1,
      });
      entity.model = new Cesium.ModelGraphics({
        uri: "/cesium/Assets/Cesium_Air.glb",
        maximumScale: 20000,
      });

      // Use CallbackPositionProperty for smooth interpolation
      // Cesium calls this every frame (~60fps) with the current time
      const icao24 = ac.icao24;
      entity.position = new Cesium.CallbackPositionProperty(
        (time: Cesium.JulianDate | undefined, result?: Cesium.Cartesian3) => {
          if (!time) return undefined;
          const pos = interpolation.getInterpolatedPosition(icao24, time);
          if (!pos) return undefined;
          return Cesium.Cartesian3.fromDegrees(
            pos.longitude,
            pos.latitude,
            pos.altitude,
            undefined,
            result
          );
        },
        false // isConstant = false (position changes over time)
      );

      // Use CallbackProperty for orientation to track interpolated position
      // true track is in decimal degrees from 0 degrees north
      // Subtract 90° because the model faces east by default in ENU frame
      entity.orientation = new Cesium.CallbackProperty(
        (time: Cesium.JulianDate | undefined) => {
          if (!time) return undefined;
          const pos = interpolation.getInterpolatedPosition(icao24, time);
          const baseline = interpolation.getBaseline(icao24);
          if (!pos || !baseline) return undefined;

          const cartesian = Cesium.Cartesian3.fromDegrees(
            pos.longitude,
            pos.latitude,
            pos.altitude
          );

          const heading = Cesium.Math.toRadians(
            (baseline.trueTrack ?? 0) - 90
          );
          const pitch = 0;
          const roll = 0;
          const hpr = new Cesium.HeadingPitchRoll(heading, pitch, roll);

          return Cesium.Transforms.headingPitchRollQuaternion(cartesian, hpr);
        },
        false // isConstant = false
      );
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
  }, [viewer, aircraft, interpolation]);

  return null;
}
