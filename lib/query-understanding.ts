import type { SearchFilters } from "./types";

const PROPERTY_TYPES = ["Townhouse", "Apartment", "Villa", "Loft"] as const;

// MVP taxonomy mirrors the synthetic Dwell dataset. In production this should
// come from your listings taxonomy/config rather than being hand-maintained.
const AREAS = [
  "Dubai Creek Harbour",
  "Jumeirah Village Triangle",
  "Jumeirah Village Circle",
  "Jumeirah Beach Road",
  "Dubai Silicon Oasis",
  "Dubai Hills Estate",
  "Palm Jumeirah",
  "Arabian Ranches 2",
  "Al Barsha South",
  "Al Safa 2",
  "Nad Al Hamar",
  "Nad Al Sheba",
  "Discovery Gardens",
  "Jumeirah Islands",
  "Jumeirah Park",
  "Arabian Ranches",
  "Barsha Heights",
  "Business Bay",
  "City Walk",
  "Damac Hills",
  "Downtown Dubai",
  "Dubai Harbour",
  "Dubai Marina",
  "Emirates Living",
  "Jumeirah",
  "Mirdif",
  "Mudon",
  "The Greens",
  "The Lakes",
  "The Meadows",
  "The Springs",
  "Town Square",
  "Umm Suqeim 3",
  "Umm Suqeim",
  "Al Barsha 2",
  "Al Barsha",
  "Al Furjan",
  "Al Quoz",
  "Al Safa",
  "Al Wasl",
];

const AREA_CENTERS: Record<string, { lat: number; lng: number }> = {
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
  "Dubai Creek Harbour": { lat: 25.20765, lng: 55.34375 },
  "Dubai Harbour": { lat: 25.103, lng: 55.145 },
  "Dubai Hills Estate": { lat: 25.055, lng: 55.243333 },
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

function normalize(value: string) {
  return value.toLowerCase().replace(/[–—]/g, "-").replace(/\s+/g, " ").trim();
}

function parseMoney(value: string) {
  const normalized = value.toLowerCase().replace(/,/g, "").replace(/\$/g, "").trim();
  const match = normalized.match(/(\d+(?:\.\d+)?)\s*(m|million|k|thousand)?/i);
  if (!match) return undefined;

  const number = Number(match[1]);
  if (!Number.isFinite(number)) return undefined;

  const suffix = match[2]?.toLowerCase();
  if (suffix === "m" || suffix === "million") return Math.round(number * 1_000_000);
  if (suffix === "k" || suffix === "thousand") return Math.round(number * 1_000);
  return Math.round(number);
}

function extractPrice(query: string, filters: SearchFilters) {
  const normalized = normalize(query);
  const next = { ...filters };

  const between = normalized.match(/(?:between|from)\s+([^\s]+(?:\s*(?:m|million|k|thousand))?)\s+(?:and|to)\s+([^\s]+(?:\s*(?:m|million|k|thousand))?)/i);
  if (between) {
    const min = parseMoney(between[1]);
    const max = parseMoney(between[2]);
    if (min !== undefined) next.minPrice = Math.max(next.minPrice ?? 0, min);
    if (max !== undefined) next.maxPrice = Math.min(next.maxPrice ?? Number.MAX_SAFE_INTEGER, max);
    return next;
  }

  const maxMatch = normalized.match(/(?:under|below|up to|no more than|not more than|maximum|max(?:imum)?(?: price)?(?: of)?)\s+([^\s]+)/i);
  if (maxMatch) {
    const max = parseMoney(maxMatch[1]);
    if (max !== undefined) next.maxPrice = Math.min(next.maxPrice ?? Number.MAX_SAFE_INTEGER, max);
  }

  const minMatch = normalized.match(/(?:over|above|at least|minimum|min(?:imum)?(?: price)?(?: of)?)\s+([^\s]+)/i);
  if (minMatch) {
    const min = parseMoney(minMatch[1]);
    if (min !== undefined) next.minPrice = Math.max(next.minPrice ?? 0, min);
  }

  return next;
}

function extractBeds(query: string, filters: SearchFilters) {
  const normalized = normalize(query);
  const next = { ...filters };

  const minimum = normalized.match(/(?:at least|minimum of|min)\s+(\d+)\s*(?:bed|beds|bedroom|bedrooms)\b/i);
  if (minimum) next.minBeds = Math.max(next.minBeds ?? 0, Number(minimum[1]));

  const maximum = normalized.match(/(?:up to|maximum of|max)\s+(\d+)\s*(?:bed|beds|bedroom|bedrooms)\b/i);
  if (maximum) next.maxBeds = Math.min(next.maxBeds ?? Number.MAX_SAFE_INTEGER, Number(maximum[1]));

  const exact = normalized.match(/\b(\d+)\s*[- ]?(?:bed|beds|bedroom|bedrooms)\b/i);
  if (exact && !minimum && !maximum) {
    const beds = Number(exact[1]);
    next.minBeds = Math.max(next.minBeds ?? 0, beds);
    next.maxBeds = Math.min(next.maxBeds ?? Number.MAX_SAFE_INTEGER, beds);
  }

  return next;
}

export type QueryPlan = {
  originalQuery: string;
  semanticQuery: string;
  filters: SearchFilters;
  propertyType?: string;
  area?: string;
  city?: string;
  hardConstraints: string[];
};

export function extractExplicitFilterPatch(query: string): SearchFilters {
  const empty: SearchFilters = {};
  const withPrice = extractPrice(query, empty);
  const withBeds = extractBeds(query, withPrice);
  const patch: SearchFilters = {};

  for (const key of [
    "minPrice",
    "maxPrice",
    "minBeds",
    "maxBeds",
  ] as const) {
    const value = withBeds[key];
    if (value !== undefined) patch[key] = value;
  }

  return patch;
}

export function understandQuery(query: string, filters: SearchFilters): QueryPlan {
  const normalized = normalize(query);
  const nextFilters = extractBeds(normalized, extractPrice(normalized, filters));
  const hardConstraints: string[] = [];

  const propertyType = PROPERTY_TYPES.find((value) => {
    const pattern = new RegExp(`\\b${value.toLowerCase()}(?:s)?\\b`, "i");
    return pattern.test(normalized);
  });
  if (propertyType) hardConstraints.push(`property type = ${propertyType}`);

  const detectedArea = AREAS
    .slice()
    .sort((a, b) => b.length - a.length)
    .find((value) => normalized.includes(normalize(value)));

  const filterArea = nextFilters.locationText
    ? AREAS
        .slice()
        .sort((a, b) => b.length - a.length)
        .find((value) => normalize(nextFilters.locationText as string) === normalize(value))
    : undefined;

  const area = detectedArea ?? filterArea;
  if (area) {
    hardConstraints.push(`area = ${area}`);

    const center = AREA_CENTERS[area];
    if (center && (nextFilters.lat === undefined || nextFilters.lng === undefined)) {
      nextFilters.lat = center.lat;
      nextFilters.lng = center.lng;
    }

    if (!nextFilters.locationText) {
      nextFilters.locationText = area;
    }
  }

  const city = normalized.includes("dubai") ? "Dubai" : undefined;
  if (city) hardConstraints.push("city = Dubai");

  return {
    originalQuery: query,
    semanticQuery: query.trim(),
    filters: nextFilters,
    propertyType,
    area,
    city,
    hardConstraints,
  };
}
