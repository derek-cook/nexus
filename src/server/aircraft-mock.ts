import type { OpenSkyState, AircraftBounds } from "./aircraft";

// Re-export the types and bounds from the real module
export { LA_BOUNDS, type OpenSkyState, type AircraftBounds } from "./aircraft";

// Generate mock aircraft within bounds that move over time
function generateMockAircraft(bounds: AircraftBounds): OpenSkyState[] {
  const now = Date.now();

  const mockAircraft: OpenSkyState[] = [
    {
      icao24: "a1b2c3",
      callsign: "UAL123",
      originCountry: "United States",
      timePosition: now,
      lastContact: now,
      longitude: bounds.lomin + 0.5 + Math.sin(now / 60000) * 0.3,
      latitude: bounds.lamin + 0.3 + Math.cos(now / 60000) * 0.2,
      baroAltitude: 10000,
      onGround: false,
      velocity: 250,
      trueTrack: 45 + Math.sin(now / 120000) * 10,
      verticalRate: 0,
      geoAltitude: 10200,
      squawk: "1200",
      spi: false,
      positionSource: 0,
      category: 4,
      typecode: "B738",
      iconType: "jet",
    },
    {
      icao24: "d4e5f6",
      callsign: "DAL456",
      originCountry: "United States",
      timePosition: now,
      lastContact: now,
      longitude: bounds.lomin + 1.2 + Math.cos(now / 50000) * 0.4,
      latitude: bounds.lamin + 0.6 + Math.sin(now / 50000) * 0.3,
      baroAltitude: 8500,
      onGround: false,
      velocity: 220,
      trueTrack: 270 + Math.cos(now / 100000) * 15,
      verticalRate: -5,
      geoAltitude: 8700,
      squawk: "1200",
      spi: false,
      positionSource: 0,
      category: 4,
      typecode: "A320",
      iconType: "jet",
    },
    {
      icao24: "g7h8i9",
      callsign: "SWA789",
      originCountry: "United States",
      timePosition: now,
      lastContact: now,
      longitude: bounds.lomin + 0.8 + Math.sin(now / 70000) * 0.5,
      latitude: bounds.lamin + 0.5 + Math.cos(now / 70000) * 0.4,
      baroAltitude: 12000,
      onGround: false,
      velocity: 280,
      trueTrack: 180 + Math.sin(now / 80000) * 20,
      verticalRate: 3,
      geoAltitude: 12200,
      squawk: "1200",
      spi: false,
      positionSource: 0,
      category: 8,
      typecode: "B407",
      iconType: "helicopter",
    },
    {
      icao24: "j1k2l3",
      callsign: "AAL321",
      originCountry: "United States",
      timePosition: now,
      lastContact: now,
      longitude: bounds.lomin + 1.5 + Math.cos(now / 45000) * 0.3,
      latitude: bounds.lamin + 0.7 + Math.sin(now / 45000) * 0.25,
      baroAltitude: 6000,
      onGround: false,
      velocity: 180,
      trueTrack: 90 + Math.cos(now / 90000) * 10,
      verticalRate: -8,
      geoAltitude: 6200,
      squawk: "1200",
      spi: false,
      positionSource: 0,
      category: 3,
      typecode: "DHC6",
      iconType: "turboprop",
    },
    {
      icao24: "m4n5o6",
      callsign: "N12345",
      originCountry: "United States",
      timePosition: now,
      lastContact: now,
      longitude: bounds.lomin + 0.6 + Math.sin(now / 90000) * 0.2,
      latitude: bounds.lamin + 0.4 + Math.cos(now / 90000) * 0.15,
      baroAltitude: 3500,
      onGround: false,
      velocity: 120,
      trueTrack: 315 + Math.sin(now / 60000) * 5,
      verticalRate: 2,
      geoAltitude: 3700,
      squawk: "1200",
      spi: false,
      positionSource: 0,
      category: 2,
      typecode: "C172",
      iconType: "light",
    },
  ];

  return mockAircraft;
}

// Mock version of fetchAircraftData - returns simulated aircraft
export async function fetchAircraftData(
  bounds?: AircraftBounds
): Promise<OpenSkyState[]> {
  // Simulate network delay
  await new Promise((resolve) => setTimeout(resolve, 100));

  const { LA_BOUNDS } = await import("./aircraft");
  const effectiveBounds = bounds ?? LA_BOUNDS;

  console.log("[MOCK] Returning mock aircraft data");
  return generateMockAircraft(effectiveBounds);
}
