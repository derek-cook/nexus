import { useEffect, useRef, useState } from "react";
import { useCesium } from "resium";
import * as Cesium from "cesium";
import { useInterpolatedAircraft } from "../hooks/useInterpolatedAircraft";
import { getAircraftIconUrl } from "../lib/aircraftIcons";

export function AircraftPoints() {
  const { aircraft, interpolation } = useInterpolatedAircraft();

  const { viewer } = useCesium();

  const entityIdsRef = useRef<Set<string>>(new Set());
  const [trackedIcao24, setTrackedIcao24] = useState<string | null>(null);
  const [sceneMode, setSceneMode] = useState(Cesium.SceneMode.SCENE2D);

  // Sync scene mode state on mount + morph transitions
  useEffect(() => {
    if (!viewer) return;

    setSceneMode(viewer.scene.mode);

    const handler = () => {
      const mode = viewer.scene.mode;
      setSceneMode(mode);

      // Toggle terrain: world terrain in 3D/Columbus, flat ellipsoid in 2D
      // (avoids Cesium terrain triangulation crash during 3D→2D morph)
      if (mode === Cesium.SceneMode.SCENE2D) {
        viewer.terrainProvider = new Cesium.EllipsoidTerrainProvider();
      } else {
        Cesium.createWorldTerrainAsync().then((tp) => {
          viewer.terrainProvider = tp;
        });
      }
    };

    viewer.scene.morphComplete.addEventListener(handler);
    return () => {
      viewer.scene.morphComplete.removeEventListener(handler);
    };
  }, [viewer]);

  // Listen for tracked entity changes
  useEffect(() => {
    if (!viewer) return;

    const handler = () => {
      const tracked = viewer.trackedEntity;
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

    const is2D = sceneMode === Cesium.SceneMode.SCENE2D;
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

      // Clear all graphics to prevent stale visuals across mode switches
      entity.billboard = undefined;
      entity.point = undefined;
      entity.model = undefined;
      entity.orientation = undefined;

      let altitude = ac.geoAltitude ?? ac.baroAltitude ?? 0;
      if (ac.onGround) altitude = 0;

      if (is2D) {
        // 2D mode: billboard icons for all aircraft
        entity.billboard = new Cesium.BillboardGraphics({
          image: getAircraftIconUrl(ac.iconType),
          color: ac.onGround ? Cesium.Color.GRAY : Cesium.Color.YELLOW,
          scale: 0.2,
          rotation: -Cesium.Math.toRadians(ac.trueTrack ?? 0),
          alignedAxis: Cesium.Cartesian3.UNIT_Z,
          verticalOrigin: Cesium.VerticalOrigin.CENTER,
          horizontalOrigin: Cesium.HorizontalOrigin.CENTER,
          disableDepthTestDistance: Number.POSITIVE_INFINITY,
        });

        if (isTracked) {
          // Interpolated position for smooth camera follow
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
        } else {
          entity.position = new Cesium.ConstantPositionProperty(
            Cesium.Cartesian3.fromDegrees(ac.longitude, ac.latitude, altitude)
          );
        }
      } else if (isTracked) {
        // 3D/Columbus, tracked: 3D model with interpolation + orientation
        entity.model = new Cesium.ModelGraphics({
          uri: "/cesium/Assets/Cesium_Air.glb",
          maximumScale: 20000,
        });

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
        // 3D/Columbus, non-tracked: point graphics
        entity.point = new Cesium.PointGraphics({
          pixelSize: 6,
          color: ac.onGround ? Cesium.Color.GRAY : Cesium.Color.YELLOW,
          outlineColor: Cesium.Color.BLACK,
          outlineWidth: 1,
          disableDepthTestDistance: Number.POSITIVE_INFINITY,
        });

        entity.position = new Cesium.ConstantPositionProperty(
          Cesium.Cartesian3.fromDegrees(ac.longitude, ac.latitude, altitude)
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
  }, [viewer, aircraft, interpolation, trackedIcao24, sceneMode]);

  return null;
}
