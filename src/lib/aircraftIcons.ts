const ICON_MAP: Record<string, string> = {
  jet: "/icons/jet.svg",
  turboprop: "/icons/turboprop.svg",
  helicopter: "/icons/helicopter.svg",
  light: "/icons/light.svg",
  unknown: "/icons/unknown.svg",
};

export function getAircraftIconUrl(iconType: string): string {
  return ICON_MAP[iconType] ?? ICON_MAP.unknown!;
}
