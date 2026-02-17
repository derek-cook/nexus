import { join } from "node:path";

const DATA_DIR = join(import.meta.dir, "..", "..", "data");
const JSON_PATH = join(DATA_DIR, "aircraft-db.json");
const CSV_PATH = join(DATA_DIR, "aircraftDatabase.csv");

export interface AircraftMeta {
  typecode: string;
  iconType: string;
}

const db = new Map<string, AircraftMeta>();

// Simple CSV line parser that handles quoted fields
function parseCSVLine(line: string): string[] {
  const fields: string[] = [];
  let current = "";
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"') {
      if (inQuotes && line[i + 1] === '"') {
        current += '"';
        i++;
      } else {
        inQuotes = !inQuotes;
      }
    } else if (ch === "," && !inQuotes) {
      fields.push(current);
      current = "";
    } else {
      current += ch;
    }
  }
  fields.push(current);
  return fields;
}

// Classify aircraft type from icaoAircraftClass (e.g. "L2J", "H1T", "L1P")
function classifyAircraft(icaoClass: string): string {
  if (!icaoClass || icaoClass.length < 2) return "unknown";

  const category = icaoClass[0];
  const engineCount = icaoClass[1];
  const engineType = icaoClass[2];

  if (category === "H" || category === "G" || category === "T")
    return "helicopter";

  if (engineType === "J") return "jet";

  if (
    engineType === "T" &&
    (engineCount === "3" ||
      engineCount === "4" ||
      engineCount === "6" ||
      engineCount === "8")
  )
    return "jet";

  if (engineType === "T") return "turboprop";

  if (engineType === "P" || engineType === "E") return "light";

  return "unknown";
}

// Load from preprocessed JSON
async function loadFromJSON(): Promise<boolean> {
  const file = Bun.file(JSON_PATH);
  if (!(await file.exists())) return false;

  const data: Record<string, AircraftMeta> = await file.json();
  for (const [icao24, meta] of Object.entries(data)) {
    db.set(icao24, meta);
  }
  console.log(`Aircraft DB: loaded ${db.size} entries from JSON`);
  return true;
}

// Fallback: parse raw CSV and generate JSON for next time
async function loadFromCSV(): Promise<boolean> {
  const file = Bun.file(CSV_PATH);
  if (!(await file.exists())) return false;

  console.log("Aircraft DB: JSON not found, parsing raw CSV...");
  const csvText = await file.text();
  const lines = csvText.split("\n");

  const headerLine = lines[0];
  if (!headerLine) return false;
  const header = parseCSVLine(headerLine);
  const icao24Idx = header.indexOf("icao24");
  const icaoClassIdx = header.indexOf("icaoaircrafttype");
  const typecodeIdx = header.indexOf("typecode");

  if (icao24Idx === -1 || icaoClassIdx === -1 || typecodeIdx === -1) {
    console.warn("Aircraft DB: could not find required columns in CSV");
    return false;
  }

  const jsonData: Record<string, AircraftMeta> = {};

  for (let i = 1; i < lines.length; i++) {
    const line = lines[i]?.trim();
    if (!line) continue;

    const fields = parseCSVLine(line);
    const icao24 = fields[icao24Idx]?.trim().toLowerCase();
    if (!icao24) continue;

    const icaoClass = fields[icaoClassIdx]?.trim() || "";
    const typecode = fields[typecodeIdx]?.trim() || "";
    const iconType = classifyAircraft(icaoClass);

    if (!typecode && iconType === "unknown") continue;

    const meta = { typecode, iconType };
    db.set(icao24, meta);
    jsonData[icao24] = meta;
  }

  // Write JSON for next time
  await Bun.write(JSON_PATH, JSON.stringify(jsonData));
  console.log(
    `Aircraft DB: parsed ${db.size} entries from CSV, wrote JSON cache`
  );
  return true;
}

export async function initAircraftDb(): Promise<void> {
  if (await loadFromJSON()) return;
  if (await loadFromCSV()) return;
  console.error(
    "Aircraft DB: no database files found. Run: bun run download-aircraft-db && bun run preprocess-aircraft-db"
  );
  process.exit(1);
}

export function getAircraftMeta(icao24: string): AircraftMeta | null {
  return db.get(icao24.toLowerCase()) ?? null;
}

// Fallback classification using ADS-B emitter category field
export function classifyByCategory(category: number | null): string {
  if (category === null || category === 0) return "unknown";
  switch (category) {
    case 1:
      return "unknown"; // No ADS-B emitter category information
    case 2:
      return "light"; // Light (< 15500 lbs)
    case 3:
      return "turboprop"; // Small (15500 to 75000 lbs)
    case 4:
    case 5:
    case 6:
    case 7:
      return "jet"; // Large/Heavy/High-perf
    case 8:
      return "helicopter"; // Rotorcraft
    case 9:
      return "light"; // Glider/sailplane
    case 10:
    case 11:
    case 12:
      return "light"; // Lighter-than-air/parachutist/ultralight
    case 14:
      return "light"; // UAV
    default:
      return "unknown";
  }
}
