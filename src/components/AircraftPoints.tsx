import { useEffect, useRef, useState } from "react";
import { useCesium } from "resium";
import * as Cesium from "cesium";
import { useInterpolatedAircraft } from "../hooks/useInterpolatedAircraft";

export function AircraftPoints() {
  const { aircraft, interpolation } = useInterpolatedAircraft();

  const { viewer } = useCesium();

  const entityIdsRef = useRef<Set<string>>(new Set());
  const [trackedIcao24, setTrackedIcao24] = useState<string | null>(null);

  // Listen for tracked entity changes
  useEffect(() => {
    if (!viewer) return;

    const handler = () => {
      const tracked = viewer.trackedEntity;
      console.log("trackedEntityChanged", tracked);
      if (tracked && tracked.id.startsWith("aircraft-")) {
        setTrackedIcao24(tracked.id.replace("aircraft-", ""));
      } else {
        setTrackedIcao24(null);
      }
    };

    viewer.trackedEntityChanged.addEventListener(handler);
    return () => {
      viewer.trackedEntityChanged.removeEventListener(handler);
    };
  }, [viewer]);

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
      const isTracked = ac.icao24 === trackedIcao24;

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

      if (isTracked) {
        entity.model = new Cesium.ModelGraphics({
          uri: "/cesium/Assets/Cesium_Air.glb",
          maximumScale: 20000,
        });

        // Use CallbackPositionProperty for smooth interpolation on tracked entity
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
          false
        );

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
            const hpr = new Cesium.HeadingPitchRoll(heading, 0, 0);

            return Cesium.Transforms.headingPitchRollQuaternion(cartesian, hpr);
          },
          false
        );
      } else {
        entity.model = undefined;

        // Use static position for non-tracked entities (updates on each data fix)
        let altitude = ac.geoAltitude ?? ac.baroAltitude ?? 0;
        if (ac.onGround) altitude = 0;

        entity.position = new Cesium.ConstantPositionProperty(
          Cesium.Cartesian3.fromDegrees(ac.longitude, ac.latitude, altitude)
        );

        const cartesian = Cesium.Cartesian3.fromDegrees(
          ac.longitude,
          ac.latitude,
          altitude
        );
        const heading = Cesium.Math.toRadians((ac.trueTrack ?? 0) - 90);
        const hpr = new Cesium.HeadingPitchRoll(heading, 0, 0);
        entity.orientation = new Cesium.ConstantProperty(
          Cesium.Transforms.headingPitchRollQuaternion(cartesian, hpr)
        );
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

    viewer.entities.resumeEvents();

    entityIdsRef.current = currentIds;
  }, [viewer, aircraft, interpolation, trackedIcao24]);

  return null;
}
