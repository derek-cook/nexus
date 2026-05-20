const ICON_DIR = "/icons/aircraft";

// Exact ICAO typecode -> icon basename. Many typecodes share one icon
// (e.g. A380 & A388 -> a380).
const TYPECODE_ICON_MAP: Record<string, string> = {
  // Airbus
  A380: "a380",
  A388: "a380",
  A318: "a320",
  A319: "a320",
  A320: "a320",
  A321: "a320",
  A19N: "a320",
  A20N: "a320",
  A21N: "a320",
  A332: "a330",
  A333: "a330",
  A337: "a330",
  A338: "a330",
  A339: "a330",
  A359: "a330", // no A350 icon; closest twin-aisle silhouette
  A35K: "a330",
  A342: "a340",
  A343: "a340",
  A345: "a340",
  A346: "a340",
  // Boeing
  B731: "b737",
  B732: "b737",
  B733: "b737",
  B734: "b737",
  B735: "b737",
  B736: "b737",
  B737: "b737",
  B738: "b737",
  B739: "b737",
  B38M: "b737",
  B39M: "b737",
  B3XM: "b737",
  B741: "b747",
  B742: "b747",
  B743: "b747",
  B744: "b747",
  B748: "b747",
  B74S: "b747",
  BLCF: "b747",
  B752: "b767",
  B753: "b767",
  B762: "b767",
  B763: "b767",
  B764: "b767",
  B772: "b777",
  B773: "b777",
  B77L: "b777",
  B77W: "b777",
  B778: "b777",
  B779: "b777",
  B788: "b787",
  B789: "b787",
  B78X: "b787",
  // McDonnell Douglas
  MD11: "md11",
  DC10: "md11",
  MD10: "md11",
  K35R: "md11",
  // Regional jets
  CRJ1: "crjx",
  CRJ2: "crjx",
  CRJ7: "crjx",
  CRJ9: "crjx",
  CRJX: "crjx",
  E170: "e195",
  E75L: "e195",
  E75S: "e195",
  E190: "e195",
  E195: "e195",
  E290: "e195",
  E295: "e195",
  E135: "erj",
  E145: "erj",
  E45X: "erj",
  ERJ: "erj",
  F100: "f100",
  F70: "f100",
  // Turboprops
  DH8A: "dh8a",
  DH8B: "dh8a",
  DH8C: "dh8a",
  DH8D: "dh8a",
  DHC6: "dh8a",
  C130: "c130",
  C30J: "c130",
  L382: "c130",
  // Business jets
  F2TH: "fa7x",
  FA50: "fa7x",
  FA7X: "fa7x",
  FA8X: "fa7x",
  F900: "fa7x",
  GLF4: "glf5",
  GLF5: "glf5",
  GLF6: "glf5",
  GLEX: "glf5",
  G280: "glf5",
  GL5T: "glf5",
  LJ35: "learjet",
  LJ45: "learjet",
  LJ60: "learjet",
  LJ75: "learjet",
  // Light
  C172: "cessna",
  C152: "cessna",
  C162: "cessna",
  C182: "cessna",
  C206: "cessna",
  C208: "cessna",
  C210: "cessna",
  C72R: "cessna",
  P28A: "cessna",
  PA18: "cessna",
  // Military fighters
  F15: "f15",
  F5: "f5",
  F111: "f11",
};

// Applied in order when the exact map misses. Precise prefixes avoid
// collisions (C17 Globemaster != C172 Cessna; B407 heli != B747).
const PREFIX_RULES: [RegExp, string][] = [
  [/^A38/, "a380"],
  [/^A33/, "a330"],
  [/^A35/, "a330"],
  [/^A34/, "a340"],
  [/^A3[12]/, "a320"],
  [/^B73/, "b737"],
  [/^B74/, "b747"],
  [/^B7[56]/, "b767"],
  [/^B77/, "b777"],
  [/^B78/, "b787"],
  [/^CRJ/, "crjx"],
  [/^E1[79]/, "e195"],
  [/^E[34]/, "erj"],
  [/^DH[C8]/, "dh8a"],
  [/^LJ/, "learjet"],
  [/^GL/, "glf5"],
  [/^(MD1|DC1)/, "md11"],
  [/^FA/, "fa7x"],
  [/^C(1[0-9]{2}|2[0-9]{2})$/, "cessna"],
];

// The a* icons are ADS-B emitter-category shapes (a7 = rotorcraft).
const ICONTYPE_FALLBACK: Record<string, string> = {
  jet: "a3",
  turboprop: "a2",
  light: "a1",
  helicopter: "a7",
  unknown: "a0",
};

function resolveBasename(typecode: string | null, iconType: string): string {
  const code = typecode?.trim().toUpperCase();
  if (code) {
    const exact = TYPECODE_ICON_MAP[code];
    if (exact) return exact;
    for (const [re, icon] of PREFIX_RULES) {
      if (re.test(code)) return icon;
    }
  }
  return ICONTYPE_FALLBACK[iconType] ?? ICONTYPE_FALLBACK.unknown!;
}

export function getAircraftIconUrl(
  typecode: string | null,
  iconType: string
): string {
  return `${ICON_DIR}/${resolveBasename(typecode, iconType)}.svg`;
}
