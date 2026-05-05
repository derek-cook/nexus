import { useCallback } from "react";
import { useCesium } from "resium";
import { useAircraftEntities } from "../hooks/useAircraftEntities";
import { AircraftSidebar } from "./AircraftSidebar";

export function AircraftLayer() {
  const { viewer } = useCesium();
  const { selectedIcao, regionalAircraft, status, lastUpdate, isSubscribed } =
    useAircraftEntities();

  const handleSelect = useCallback(
    (icao24: string) => {
      if (!viewer) return;
      const entity = viewer.entities.getById(`aircraft-${icao24}`);
      if (entity) viewer.selectedEntity = entity;
    },
    [viewer]
  );

  return (
    <AircraftSidebar
      aircraft={regionalAircraft}
      selectedIcao24={selectedIcao}
      onSelectAircraft={handleSelect}
      status={status}
      lastUpdate={lastUpdate}
      isSubscribed={isSubscribed}
    />
  );
}
