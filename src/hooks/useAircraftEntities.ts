import { useCallback, useEffect, useRef, useState } from "react";
import { useCesium } from "resium";
import * as Cesium from "cesium";
import { useGlobalAircraft, type AircraftState } from "./useGlobalAircraft";
import { useRegionalAircraft } from "./useRegionalAircraft";
import { useTrackedAircraft } from "./useTrackedAircraft";
import { useViewportBounds } from "./useViewportBounds";
import {
  aircraftInterpolation,
  type AircraftBaseline,
} from "../lib/aircraftInterpolation";
import { getAircraftIconUrl } from "../lib/aircraftIcons";

// Grace window: a globally-missing aircraft is kept around if regional or
// track touched it within this window. Prevents the user's viewport
// aircraft from flickering on the worldwide global poll.
const REGIONAL_GRACE_MS = 30_000;

// Validation mode: subscribe directly to a known-flying icao24 via the
// track channel only (global + regional disabled). On the first track fix
// the orchestration hook auto-engages viewer.trackedEntity so the camera
// follow + CallbackPositionProperty swap kicks in without manual UI.
// Set to "" to disable.
const VALIDATE_TRACK_ICAO: string = "";

interface VisualFields {
  iconType: string;
  onGround: boolean;
  trueTrack: number | null;
}

function aircraftCartesian(ac: AircraftState): Cesium.Cartesian3 {
  let altitude = ac.geoAltitude ?? ac.baroAltitude ?? 0;
  if (ac.onGround) altitude = 0;
  return Cesium.Cartesian3.fromDegrees(ac.longitude!, ac.latitude!, altitude);
}

function baselineCartesian(b: AircraftBaseline): Cesium.Cartesian3 {
  return Cesium.Cartesian3.fromDegrees(b.longitude, b.latitude, b.altitude);
}

function applyGraphics(
  entity: Cesium.Entity,
  visual: VisualFields,
  isTracked: boolean,
  is2D: boolean
) {
  entity.billboard = undefined;
  entity.point = undefined;
  entity.model = undefined;

  if (is2D) {
    entity.billboard = new Cesium.BillboardGraphics({
      image: getAircraftIconUrl(visual.iconType),
      color: visual.onGround ? Cesium.Color.GRAY : Cesium.Color.YELLOW,
      scale: 0.2,
      rotation: -Cesium.Math.toRadians(visual.trueTrack ?? 0),
      alignedAxis: Cesium.Cartesian3.UNIT_Z,
      verticalOrigin: Cesium.VerticalOrigin.CENTER,
      horizontalOrigin: Cesium.HorizontalOrigin.CENTER,
      disableDepthTestDistance: Number.POSITIVE_INFINITY,
    });
  } else if (isTracked) {
    entity.model = new Cesium.ModelGraphics({
      uri: "/cesium/Assets/Cesium_Air.glb",
      maximumScale: 20000,
    });
  } else {
    entity.point = new Cesium.PointGraphics({
      pixelSize: 6,
      color: visual.onGround ? Cesium.Color.GRAY : Cesium.Color.YELLOW,
      outlineColor: Cesium.Color.BLACK,
      outlineWidth: 1,
      disableDepthTestDistance: Number.POSITIVE_INFINITY,
    });
  }
}

function makeTrackedPosition(icao24: string): Cesium.CallbackPositionProperty {
  return new Cesium.CallbackPositionProperty((time, result) => {
    if (!time) return undefined;
    const pos = aircraftInterpolation.getInterpolatedPosition(icao24, time);
    if (!pos) return undefined;
    return Cesium.Cartesian3.fromDegrees(
      pos.longitude,
      pos.latitude,
      pos.altitude,
      undefined,
      result
    );
  }, false);
}

function makeTrackedOrientation(icao24: string): Cesium.CallbackProperty {
  return new Cesium.CallbackProperty((time) => {
    if (!time) return undefined;
    const pos = aircraftInterpolation.getInterpolatedPosition(icao24, time);
    const baseline = aircraftInterpolation.getBaseline(icao24);
    if (!pos || !baseline) return undefined;
    const cart = Cesium.Cartesian3.fromDegrees(
      pos.longitude,
      pos.latitude,
      pos.altitude
    );
    const heading = Cesium.Math.toRadians((baseline.trueTrack ?? 0) - 90);
    const hpr = new Cesium.HeadingPitchRoll(heading, 0, 0);
    return Cesium.Transforms.headingPitchRollQuaternion(cart, hpr);
  }, false);
}

// Single orchestration hook owning the viewer.entities collection. The data
// hooks call applyBatch via their onBatch callbacks, which mutates the Cesium
// scene imperatively (no React state churn for the bulk aircraft set).
export function useAircraftEntities() {
  const { viewer } = useCesium();
  const { center, regionalEnabled } = useViewportBounds(viewer);

  const [sceneMode, setSceneMode] = useState<Cesium.SceneMode>(
    Cesium.SceneMode.SCENE2D
  );
  const [trackedIcao, setTrackedIcao] = useState<string | null>(null);
  const [selectedIcao, setSelectedIcao] = useState<string | null>(null);

  const entitiesRef = useRef<Map<string, Cesium.Entity>>(new Map());
  const positionPropsRef = useRef<Map<string, Cesium.ConstantPositionProperty>>(
    new Map()
  );
  const lastSeenRef = useRef<Map<string, number>>(new Map());
  const sceneModeRef = useRef<Cesium.SceneMode>(Cesium.SceneMode.SCENE2D);
  const trackedIcaoRef = useRef<string | null>(null);

  useEffect(() => {
    sceneModeRef.current = sceneMode;
  }, [sceneMode]);
  // trackedIcaoRef is updated synchronously inside the trackedEntityChanged
  // handler (below) so the entity property swap can happen on the same tick
  // Cesium activates camera follow.

  // Scene mode + terrain
  useEffect(() => {
    if (!viewer) return;
    setSceneMode(viewer.scene.mode);
    sceneModeRef.current = viewer.scene.mode;

    const handler = () => {
      const mode = viewer.scene.mode;
      setSceneMode(mode);
      sceneModeRef.current = mode;

      // Avoid the Cesium terrain triangulation crash during 3D→2D morph.
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

  // Tracked entity sync. The property swap runs synchronously inside the
  // handler so Cesium's camera follow reads the CallbackPositionProperty on
  // the very next frame — without this, the camera locks onto a stale
  // ConstantPositionProperty for one render tick before the React effect
  // catches up.
  useEffect(() => {
    if (!viewer) return;
    const handler = () => {
      const tracked = viewer.trackedEntity;
      const next =
        tracked?.id &&
        typeof tracked.id === "string" &&
        tracked.id.startsWith("aircraft-")
          ? tracked.id.replace("aircraft-", "")
          : null;
      const prev = trackedIcaoRef.current;
      if (prev === next) return;

      const is2D = sceneModeRef.current === Cesium.SceneMode.SCENE2D;
      viewer.entities.suspendEvents();
      try {
        if (prev) {
          const entity = entitiesRef.current.get(prev);
          const baseline = aircraftInterpolation.getBaseline(prev);
          if (entity && baseline) {
            applyGraphics(entity, baseline, false, is2D);
            const prop = new Cesium.ConstantPositionProperty(
              baselineCartesian(baseline)
            );
            positionPropsRef.current.set(prev, prop);
            entity.position = prop;
            entity.orientation = undefined;
          }
        }
        if (next) {
          const entity = entitiesRef.current.get(next);
          const baseline = aircraftInterpolation.getBaseline(next);
          if (entity && baseline) {
            applyGraphics(entity, baseline, true, is2D);
            entity.position = makeTrackedPosition(next);
            entity.orientation = is2D
              ? undefined
              : makeTrackedOrientation(next);
            positionPropsRef.current.delete(next);
          }
        }
      } finally {
        viewer.entities.resumeEvents();
      }

      trackedIcaoRef.current = next;
      setTrackedIcao(next);
    };
    viewer.trackedEntityChanged.addEventListener(handler);
    handler();
    return () => {
      viewer.trackedEntityChanged.removeEventListener(handler);
    };
  }, [viewer]);

  // Selected entity sync
  useEffect(() => {
    if (!viewer) return;
    const handler = () => {
      const sel = viewer.selectedEntity;
      if (
        sel?.id &&
        typeof sel.id === "string" &&
        sel.id.startsWith("aircraft-")
      ) {
        setSelectedIcao(sel.id.replace("aircraft-", ""));
      } else {
        setSelectedIcao(null);
      }
    };
    viewer.selectedEntityChanged.addEventListener(handler);
    handler();
    return () => {
      viewer.selectedEntityChanged.removeEventListener(handler);
    };
  }, [viewer]);

  // Imperative batch application — the hot path. Touches only the entities
  // mentioned in `fixes`. The global source additionally sweeps stale
  // entities (and their baselines) using the lastSeen grace window.
  const applyBatch = useCallback(
    (fixes: AircraftState[], source: "global" | "regional" | "track") => {
      if (!viewer) return;
      const is2D = sceneModeRef.current === Cesium.SceneMode.SCENE2D;
      const trackedIcaoLocal = trackedIcaoRef.current;
      const now = performance.now();

      viewer.entities.suspendEvents();
      try {
        for (const ac of fixes) {
          if (ac.latitude === null || ac.longitude === null) continue;
          lastSeenRef.current.set(ac.icao24, now);

          const isTracked = ac.icao24 === trackedIcaoLocal;
          let entity = entitiesRef.current.get(ac.icao24);

          if (!entity) {
            entity = viewer.entities.getOrCreateEntity(`aircraft-${ac.icao24}`);
            entitiesRef.current.set(ac.icao24, entity);
            entity.name = ac.callsign || ac.icao24;
            applyGraphics(entity, ac, isTracked, is2D);

            if (isTracked) {
              entity.position = makeTrackedPosition(ac.icao24);
              if (!is2D) {
                entity.orientation = makeTrackedOrientation(ac.icao24);
              }
            } else {
              const prop = new Cesium.ConstantPositionProperty(
                aircraftCartesian(ac)
              );
              positionPropsRef.current.set(ac.icao24, prop);
              entity.position = prop;
            }
            continue;
          }

          // Existing entity. Keep cheap metadata fresh.
          entity.name = ac.callsign || ac.icao24;

          if (isTracked) {
            // Tracked entity reads interpolation each frame via
            // CallbackPositionProperty. Updating the baseline (already done
            // by the data hook) is sufficient.
            continue;
          }

          let prop = positionPropsRef.current.get(ac.icao24);
          if (prop) {
            prop.setValue(aircraftCartesian(ac));
          } else {
            // Entity was previously tracked; rebuild constant property.
            prop = new Cesium.ConstantPositionProperty(aircraftCartesian(ac));
            positionPropsRef.current.set(ac.icao24, prop);
            entity.position = prop;
          }

          // Update mutable visuals so heading/onGround changes show up.
          if (entity.billboard) {
            entity.billboard.rotation = new Cesium.ConstantProperty(
              -Cesium.Math.toRadians(ac.trueTrack ?? 0)
            );
            entity.billboard.color = new Cesium.ConstantProperty(
              ac.onGround ? Cesium.Color.GRAY : Cesium.Color.YELLOW
            );
          } else if (entity.point) {
            entity.point.color = new Cesium.ConstantProperty(
              ac.onGround ? Cesium.Color.GRAY : Cesium.Color.YELLOW
            );
          }
        }

        if (source === "global") {
          const inFix = new Set<string>();
          for (const ac of fixes) inFix.add(ac.icao24);
          for (const [icao, entity] of entitiesRef.current) {
            if (inFix.has(icao)) continue;
            const lastSeen = lastSeenRef.current.get(icao) ?? 0;
            if (now - lastSeen <= REGIONAL_GRACE_MS) continue;
            viewer.entities.remove(entity);
            entitiesRef.current.delete(icao);
            positionPropsRef.current.delete(icao);
            lastSeenRef.current.delete(icao);
            aircraftInterpolation.remove(icao);
          }
        }
      } finally {
        viewer.entities.resumeEvents();
      }
    },
    [viewer]
  );

  const onGlobalBatch = useCallback(
    (fixes: AircraftState[]) => applyBatch(fixes, "global"),
    [applyBatch]
  );
  const global = useGlobalAircraft({ onBatch: onGlobalBatch });

  const onRegionalBatch = useCallback(
    (fixes: AircraftState[]) => applyBatch(fixes, "regional"),
    [applyBatch]
  );
  const regional = useRegionalAircraft(center, regionalEnabled, {
    onBatch: onRegionalBatch,
  });

  const onTrackUpdate = useCallback(
    (fix: AircraftState) => {
      applyBatch([fix], "track");
      // Auto-engage Cesium camera follow on the validation aircraft so the
      // tracked-entity handler swaps in CallbackPositionProperty and we get
      // smooth interpolation immediately, without needing UI to pick it.
      if (
        viewer &&
        VALIDATE_TRACK_ICAO &&
        fix.icao24.toLowerCase() === VALIDATE_TRACK_ICAO.toLowerCase() &&
        !viewer.trackedEntity
      ) {
        const entity = entitiesRef.current.get(fix.icao24);
        if (entity) viewer.trackedEntity = entity;
      }
    },
    [applyBatch, viewer]
  );

  const validateIcao = VALIDATE_TRACK_ICAO || null;
  const tracked = useTrackedAircraft(trackedIcao ?? validateIcao, {
    onUpdate: onTrackUpdate,
  });

  // Scene mode swap: rare event, repaint every entity for the new mode.
  // Position properties (Constant for non-tracked, Callback for tracked)
  // are preserved.
  const prevSceneModeRef = useRef<Cesium.SceneMode | null>(null);
  useEffect(() => {
    if (!viewer) return;
    if (prevSceneModeRef.current === sceneMode) return;
    prevSceneModeRef.current = sceneMode;
    const is2D = sceneMode === Cesium.SceneMode.SCENE2D;

    viewer.entities.suspendEvents();
    try {
      for (const [icao, entity] of entitiesRef.current) {
        const baseline = aircraftInterpolation.getBaseline(icao);
        if (!baseline) continue;
        const isTracked = icao === trackedIcaoRef.current;
        applyGraphics(entity, baseline, isTracked, is2D);
        if (isTracked) {
          entity.orientation = is2D ? undefined : makeTrackedOrientation(icao);
        } else {
          entity.orientation = undefined;
        }
      }
    } finally {
      viewer.entities.resumeEvents();
    }
  }, [sceneMode, viewer]);

  return {
    sceneMode,
    trackedIcao,
    selectedIcao,
    regionalAircraft: regional.aircraft,
    status: global.status,
    isSubscribed: global.isSubscribed,
    lastUpdate: Math.max(
      global.lastUpdate ?? 0,
      regional.lastUpdate ?? 0,
      tracked.lastUpdate ?? 0
    ),
  };
}
