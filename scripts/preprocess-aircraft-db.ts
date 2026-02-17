import { join } from "node:path";

const DATA_DIR = join(import.meta.dir, "..", "data");
const CSV_PATH = join(DATA_DIR, "aircraftDatabase.csv");
const JSON_PATH = join(DATA_DIR, "aircraft-db.json");

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

  const category = icaoClass[0]; // L=landplane, H=helicopter, S=seaplane, etc.
  const engineCount = icaoClass[1];
  const engineType = icaoClass[2]; // P=piston, T=turboprop, J=jet, E=electric

  // Helicopters, gyrocopters, tiltrotors
  if (category === "H" || category === "G" || category === "T")
    return "helicopter";

  // Jets
  if (engineType === "J") return "jet";

  // Large turboprops (3+ engines) → treat as jet
  if (
    engineType === "T" &&
    (engineCount === "3" || engineCount === "4" || engineCount === "6" || engineCount === "8")
  )
    return "jet";

  // Turboprops (1-2 engines)
  if (engineType === "T") return "turboprop";

  // Piston and electric → light
  if (engineType === "P" || engineType === "E") return "light";

  return "unknown";
}

const csvFile = Bun.file(CSV_PATH);
if (!(await csvFile.exists())) {
  console.error(
    "CSV not found. Run: bun run scripts/download-aircraft-db.ts first"
  );
  process.exit(1);
}

console.log("Reading CSV...");
const csvText = await csvFile.text();
const lines = csvText.split("\n");

// Parse header to find column indices dynamically
const headerLine = lines[0];
if (!headerLine) {
  console.error("CSV file is empty");
  process.exit(1);
}
const header = parseCSVLine(headerLine);
const icao24Idx = header.indexOf("icao24");
const icaoClassIdx = header.indexOf("icaoaircrafttype");
const typecodeIdx = header.indexOf("typecode");

if (icao24Idx === -1 || icaoClassIdx === -1 || typecodeIdx === -1) {
  console.error("Could not find required columns in CSV header");
  console.error("Header:", header.join(", "));
  process.exit(1);
}

console.log(
  `Column indices: icao24=${icao24Idx}, icaoaircrafttype=${icaoClassIdx}, typecode=${typecodeIdx}`
);

const db: Record<string, { typecode: string; iconType: string }> = {};
let processed = 0;
let skipped = 0;

for (let i = 1; i < lines.length; i++) {
  const line = lines[i]?.trim();
  if (!line) continue;

  const fields = parseCSVLine(line);
  const icao24 = fields[icao24Idx]?.trim().toLowerCase();
  if (!icao24) continue;

  const icaoClass = fields[icaoClassIdx]?.trim() || "";
  const typecode = fields[typecodeIdx]?.trim() || "";
  const iconType = classifyAircraft(icaoClass);

  // Skip entries with no useful data
  if (!typecode && iconType === "unknown") {
    skipped++;
    continue;
  }

  db[icao24] = { typecode, iconType };
  processed++;
}

console.log(`Processed ${processed} entries, skipped ${skipped}`);

await Bun.write(JSON_PATH, JSON.stringify(db));
const jsonFile = Bun.file(JSON_PATH);
console.log(
  `Wrote ${(jsonFile.size / 1024 / 1024).toFixed(1)}MB to data/aircraft-db.json`
);
