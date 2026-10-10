/**
 * Approximate reference points for the synthetic Dwell Dubai dataset.
 * These are neighborhood anchors for straight-line radius filtering, not
 * official boundaries or driving-route origins.
 */
export type AreaCenter = { lat: number; lng: number };

export const AREA_CENTERS: Record<string, AreaCenter> = {
  "Al Barsha": { lat: 25.1121, lng: 55.2015 },
  "Al Barsha 2": { lat: 25.104, lng: 55.214 },
  "Al Barsha South": { lat: 25.083, lng: 55.207 },
  "Al Furjan": { lat: 25.026, lng: 55.149 },
  "Al Quoz": { lat: 25.139, lng: 55.222 },
  "Al Safa": { lat: 25.1812, lng: 55.2361 },
  "Al Safa 2": { lat: 25.177, lng: 55.224 },
  "Al Wasl": { lat: 25.198, lng: 55.248 },
  "Arabian Ranches": { lat: 25.0576, lng: 55.2708 },
  "Arabian Ranches 2": { lat: 25.047, lng: 55.275 },
  "Barsha Heights": { lat: 25.099, lng: 55.173 },
  "Business Bay": { lat: 25.187, lng: 55.269 },
  "City Walk": { lat: 25.205, lng: 55.263 },
  "Damac Hills": { lat: 25.034, lng: 55.244 },
  "Discovery Gardens": { lat: 25.037, lng: 55.145 },
  "Downtown Dubai": { lat: 25.197, lng: 55.274 },
  "Dubai": { lat: 25.2048, lng: 55.2708 },
  "Dubai Creek Harbour": { lat: 25.20765, lng: 55.34375 },
  "Dubai Harbour": { lat: 25.103, lng: 55.145 },
  "Dubai Hills Estate": { lat: 25.055, lng: 55.24333 },
  "Dubai Marina": { lat: 25.08, lng: 55.142 },
  "Dubai Silicon Oasis": { lat: 25.123, lng: 55.381 },
  "Emirates Living": { lat: 25.073, lng: 55.157 },
  "Jumeirah": { lat: 25.2048, lng: 55.2708 },
  "Jumeirah Beach Road": { lat: 25.194, lng: 55.227 },
  "Jumeirah Islands": { lat: 25.055, lng: 55.152 },
  "Jumeirah Park": { lat: 25.0412, lng: 55.1538 },
  "Jumeirah Village Circle": { lat: 25.045, lng: 55.209 },
  "Jumeirah Village Triangle": { lat: 25.0275, lng: 55.1815 },
  "Mirdif": { lat: 25.23245, lng: 55.4131 },
  "Mudon": { lat: 25.0147, lng: 55.3271 },
  "Nad Al Hamar": { lat: 25.229, lng: 55.395 },
  "Nad Al Sheba": { lat: 25.174, lng: 55.391 },
  "Palm Jumeirah": { lat: 25.11, lng: 55.138 },
  "The Greens": { lat: 25.091, lng: 55.177 },
  "The Lakes": { lat: 25.071, lng: 55.164 },
  "The Meadows": { lat: 25.0705, lng: 55.17 },
  "The Springs": { lat: 25.0628, lng: 55.2018 },
  "Town Square": { lat: 25.0052, lng: 55.29805 },
  "Umm Suqeim": { lat: 25.145, lng: 55.202 },
  "Umm Suqeim 3": { lat: 25.151, lng: 55.202 },
};

const normalizedCenters = new Map(
  Object.entries(AREA_CENTERS).map(([name, center]) => [normalizeArea(name), center]),
);

function normalizeArea(value: string) {
  return value.toLowerCase().replace(/[–—]/g, "-").replace(/\s+/g, " ").trim();
}

/** Returns a known area's approximate reference point, case-insensitively. */
export function resolveAreaCenter(value?: string): AreaCenter | undefined {
  if (!value?.trim()) return undefined;
  return normalizedCenters.get(normalizeArea(value));
}
