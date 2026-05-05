/**
 * Singleton service managing aircraft state and interpolation.
 * Stores baselines from API fixes and provides interpolated positions
 * for Cesium's CallbackPositionProperty to query at 60fps.
 */

import * as Cesium from "cesium";
import type { AircraftState } from "../hooks/useGlobalAircraft";
import { projectPosition, type GeoPosition } from "./geoMath";

/** Baseline state captured from an API fix */
export interface AircraftBaseline {
  icao24: string;
  callsign: string | null;
  iconType: string;
  latitude: number;
  longitude: number;
  altitude: number; // meters
  velocity: number | null; // m/s
  trueTrack: number | null; // degrees from north
  fixTime: number; // timestamp when this fix was received (ms)
  verticalRate: number | null; // m/s
  onGround: boolean;
}

/** Interpolated position with altitude */
export interface InterpolatedPosition extends GeoPosition {
  altitude: number;
}

/**
 * Maximum projection time in seconds.
 * Beyond this, we don't trust the projection accuracy.
 */
const MAX_PROJECTION_SECONDS = 30;

class AircraftInterpolationService {
  private baselines = new Map<string, AircraftBaseline>();

  /**
   * Update baselines from a fresh API fix.
   * Called when WebSocket data arrives.
   *
   * Each baseline's `fixTime` defaults to the per-aircraft `timePosition`
   * (OpenSky reports it in Unix seconds — converted to ms here) so that
   * interpolation projects forward from the actual source fix time, not the
   * server's broadcast time. Falls back to `fixTime` (broadcast timestamp)
   * when `timePosition` is null.
   *
   * @param removeMissing When true (e.g. for the global channel which sends a
   *   full worldwide snapshot), baselines absent from `aircraft` are deleted.
   *   Regional and tracked updates pass `false` so they only refresh / add.
   */
  updateFromFix(
    aircraft: AircraftState[],
    fixTime: number = Date.now(),
    { removeMissing = false }: { removeMissing?: boolean } = {}
  ): void {
    const currentIds = new Set<string>();
    for (const ac of aircraft) {
      if (ac.latitude === null || ac.longitude === null) continue;

      currentIds.add(ac.icao24);

      let altitude = ac.geoAltitude ?? ac.baroAltitude ?? 0;
      if (ac.onGround) altitude = 0;

      const sourceFixTime =
        ac.timePosition !== null ? ac.timePosition * 1000 : fixTime;

      this.baselines.set(ac.icao24, {
        icao24: ac.icao24,
        callsign: ac.callsign,
        iconType: ac.iconType,
        latitude: ac.latitude,
        longitude: ac.longitude,
        altitude,
        velocity: ac.velocity,
        trueTrack: ac.trueTrack,
        fixTime: sourceFixTime,
        verticalRate: ac.verticalRate,
        onGround: ac.onGround,
      });
    }

    if (removeMissing) {
      for (const icao24 of this.baselines.keys()) {
        if (!currentIds.has(icao24)) {
          this.baselines.delete(icao24);
        }
      }
    }
  }

  /**
   * Get interpolated position for an aircraft.
   * Called by Cesium every frame (~60fps).
   *
   * @param icao24 Aircraft identifier
   * @param julianDate Cesium JulianDate for current render time
   * @returns Interpolated position or undefined if not available
   */
  getInterpolatedPosition(
    icao24: string,
    julianDate: Cesium.JulianDate
  ): InterpolatedPosition | undefined {
    const baseline = this.baselines.get(icao24);
    if (!baseline) return undefined;

    // Convert JulianDate to JS timestamp
    const currentTime = Cesium.JulianDate.toDate(julianDate).getTime();
    const deltaSeconds = (currentTime - baseline.fixTime) / 1000;

    // No interpolation if time is in the past or invalid
    if (deltaSeconds <= 0) {
      return {
        latitude: baseline.latitude,
        longitude: baseline.longitude,
        altitude: baseline.altitude,
      };
    }

    // No interpolation if velocity or heading is missing
    if (baseline.velocity === null || baseline.trueTrack === null) {
      return {
        latitude: baseline.latitude,
        longitude: baseline.longitude,
        altitude: baseline.altitude,
      };
    }

    // No interpolation if aircraft is stationary
    if (baseline.velocity === 0 || baseline.onGround) {
      return {
        latitude: baseline.latitude,
        longitude: baseline.longitude,
        altitude: baseline.altitude,
      };
    }

    // Clamp projection time to prevent runaway extrapolation
    const clampedDelta = Math.min(deltaSeconds, MAX_PROJECTION_SECONDS);

    // Project position forward
    const projected = projectPosition(
      { latitude: baseline.latitude, longitude: baseline.longitude },
      { speed: baseline.velocity, heading: baseline.trueTrack },
      clampedDelta
    );

    return {
      ...projected,
      altitude: baseline.altitude, // Altitude interpolation is future milestone
    };
  }

  /**
   * Get raw baseline data for an aircraft.
   * Used for orientation computation and metadata access.
   */
  getBaseline(icao24: string): AircraftBaseline | undefined {
    return this.baselines.get(icao24);
  }

  /**
   * Snapshot of every known baseline. Consumers (e.g. the sidebar) poll this
   * at a low cadence rather than re-rendering on every WS fix.
   */
  getAllBaselines(): AircraftBaseline[] {
    return Array.from(this.baselines.values());
  }

  /**
   * Remove a single baseline. Used by the entity manager when global drops
   * an aircraft.
   */
  remove(icao24: string): void {
    this.baselines.delete(icao24);
  }

  /**
   * Clear all baselines.
   * Useful for testing or reset scenarios.
   */
  clear(): void {
    this.baselines.clear();
  }
}

/** Singleton instance */
export const aircraftInterpolation = new AircraftInterpolationService();
