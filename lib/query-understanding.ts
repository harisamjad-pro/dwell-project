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

  const area = AREAS
    .slice()
    .sort((a, b) => b.length - a.length)
    .find((value) => normalized.includes(normalize(value)));
  if (area) hardConstraints.push(`area = ${area}`);

  const city = normalized.includes("dubai") ? "Dubai" : undefined;
  if (city) hardConstraints.push("city = Dubai");

  // The original query remains the semantic signal. Explicit structured facts
  // are additionally passed to SQL so they cannot be washed out by embeddings.
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
