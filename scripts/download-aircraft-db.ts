import { mkdir } from "node:fs/promises";
import { join } from "node:path";

const DATA_DIR = join(import.meta.dir, "..", "data");
const CSV_PATH = join(DATA_DIR, "aircraftDatabase.csv");
const CSV_URL =
  "https://opensky-network.org/datasets/metadata/aircraftDatabase.csv";

await mkdir(DATA_DIR, { recursive: true });

console.log(`Fetching ${CSV_URL}`);
const response = await fetch(CSV_URL, { redirect: "follow" });

if (!response.ok) {
  console.error(`Download failed: ${response.status} ${response.statusText}`);
  process.exit(1);
}

const totalBytes = Number(response.headers.get("content-length") || 0);
const totalMB = (totalBytes / 1024 / 1024).toFixed(1);
if (totalBytes) {
  console.log(`File size: ${totalMB}MB`);
}

const writer = Bun.file(CSV_PATH).writer();
let downloaded = 0;
let lastLog = 0;

for await (const chunk of response.body!) {
  writer.write(chunk);
  downloaded += chunk.length;

  const now = Date.now();
  if (now - lastLog > 2000) {
    const mb = (downloaded / 1024 / 1024).toFixed(1);
    const pct = totalBytes ? ` (${((downloaded / totalBytes) * 100).toFixed(0)}%)` : "";
    process.stdout.write(`\r  ${mb}MB${totalBytes ? " / " + totalMB + "MB" : ""}${pct}`);
    lastLog = now;
  }
}

await writer.end();

const finalMB = (downloaded / 1024 / 1024).toFixed(1);
console.log(`\nDownloaded ${finalMB}MB to data/aircraftDatabase.csv`);
