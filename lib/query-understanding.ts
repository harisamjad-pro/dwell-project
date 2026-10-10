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

const NUMBER_PATTERN = String.raw`(?:\d{1,3}(?:,\d{3})+|\d+)(?:\.\d+)?`;
const MONEY_SCALE_PATTERN = String.raw`(?:million|thousand|m(?!iles?\b)|k)`;
const MONEY_RANGE_SOURCE = String.raw`\b(?:between|from|in|budget(?:\s+of)?|priced\s+between)?\s*(aed\s*)?(${NUMBER_PATTERN})\s*(${MONEY_SCALE_PATTERN})?\s*(?:-|to|and)\s*(?:aed\s*)?(${NUMBER_PATTERN})\s*(${MONEY_SCALE_PATTERN})?\s*(aed|dirhams?)?\b`;

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

function parseMoneyWithScale(amount: string, scale?: string) {
  return parseMoney(`${amount}${scale ?? ""}`);
}

const RADIUS_UNITS = "miles?|mi|kilometers?|kilometres?|km";

function parseRadiusMiles(amountText: string, unitText: string): number | undefined {
  const amount = Number(amountText);
  if (!Number.isFinite(amount) || amount <= 0) return undefined;

  const unit = unitText.toLowerCase();
  const miles = /^(?:km|kilomet)/i.test(unit) ? amount / 1.609344 : amount;
  // The search endpoint currently caps supported radius searches at 100 miles.
  return Math.min(100, Math.round(miles * 100) / 100);
}

/** Recognize either a single maximum radius or a distance band in natural language. */
function extractRadius(query: string, filters: SearchFilters) {
  const normalized = normalize(query);
  const next = { ...filters };
  const rangePatterns = [
    new RegExp(`\\bwithin\\s+(?:a\\s+)?(\\d+(?:\\.\\d+)?)\\s*(?:-|to)\\s*(\\d+(?:\\.\\d+)?)\\s*[- ]?(${RADIUS_UNITS})\\b`, "i"),
    new RegExp(`\\b(?:between|from)\\s+(\\d+(?:\\.\\d+)?)\\s*(?:-|to|and)\\s*(\\d+(?:\\.\\d+)?)\\s*[- ]?(${RADIUS_UNITS})\\b`, "i"),
  ];

  for (const pattern of rangePatterns) {
    const match = normalized.match(pattern);
    if (!match) continue;

    const first = parseRadiusMiles(match[1], match[3]);
    const second = parseRadiusMiles(match[2], match[3]);
    if (first !== undefined && second !== undefined) {
      const lower = Math.min(first, second);
      const upper = Math.max(first, second);
      next.minRadiusMiles = Math.max(next.minRadiusMiles ?? 0, lower);
      next.radiusMiles = Math.min(next.radiusMiles ?? 100, upper);
    }
    return next;
  }

  const singlePatterns = [
    new RegExp(`\\bwithin\\s+(?:a\\s+)?(\\d+(?:\\.\\d+)?)\\s*[- ]?(${RADIUS_UNITS})\\b`, "i"),
    new RegExp(`\\bradius(?:\\s+of)?\\s+(\\d+(?:\\.\\d+)?)\\s*[- ]?(${RADIUS_UNITS})\\b`, "i"),
    new RegExp(`\\b(\\d+(?:\\.\\d+)?)\\s*[- ]?(${RADIUS_UNITS})\\s+(?:radius|of|from|around)\\b`, "i"),
  ];

  for (const pattern of singlePatterns) {
    const match = normalized.match(pattern);
    if (!match) continue;
    const radiusMiles = parseRadiusMiles(match[1], match[2]);
    if (radiusMiles !== undefined && radiusMiles > 0) {
      next.radiusMiles = Math.min(next.radiusMiles ?? 100, radiusMiles);
    }
    break;
  }

  return next;
}

function extractPrice(query: string, filters: SearchFilters) {
  const normalized = normalize(query);
  const next = { ...filters };

  // Recognize money bands such as "in 2-2.5m AED", "AED 2m to 2.5m",
  // "between 2 and 2.5 million", and "2,000,000-2,500,000 AED".
  // The money-marker check deliberately prevents distance bands like
  // "within 1.5-2.4 miles" from being mistaken for AED price bands.
  const rangeRegex = new RegExp(MONEY_RANGE_SOURCE, "gi");
  let rangeMatch: RegExpExecArray | null;
  while ((rangeMatch = rangeRegex.exec(normalized)) !== null) {
    const [, prefixCurrency, firstAmount, firstScale, secondAmount, secondScale, suffixCurrency] = rangeMatch;
    if (!prefixCurrency && !firstScale && !secondScale && !suffixCurrency) continue;

    // A suffix on one endpoint applies to both endpoints when the other is bare,
    // e.g. "2-2.5m AED" means AED 2m through AED 2.5m.
    const sharedScale = firstScale || secondScale;
    const minimum = parseMoneyWithScale(firstAmount, firstScale || sharedScale);
    const maximum = parseMoneyWithScale(secondAmount, secondScale || sharedScale);
    if (minimum === undefined || maximum === undefined) continue;

    const lower = Math.min(minimum, maximum);
    const upper = Math.max(minimum, maximum);
    next.minPrice = Math.max(next.minPrice ?? 0, lower);
    next.maxPrice = Math.min(next.maxPrice ?? Number.MAX_SAFE_INTEGER, upper);
    return next;
  }

  // In real-estate searches, "in 3.5m" / "in 3.5 m" is treated as a budget
  // ceiling. An explicit lower-to-upper range above takes precedence.
  const budgetMatch = normalized.match(
    new RegExp(
      `\\b(?:in|for|budget(?:\\s+of)?|priced\\s+at|price\\s+of)\\s+(?:aed\\s*)?(${NUMBER_PATTERN})\\s*(${MONEY_SCALE_PATTERN})\\b(?:\\s*(?:aed|dirhams?))?`,
      "i",
    ),
  );
  if (budgetMatch) {
    const max = parseMoneyWithScale(budgetMatch[1], budgetMatch[2]);
    if (max !== undefined) next.maxPrice = Math.min(next.maxPrice ?? Number.MAX_SAFE_INTEGER, max);
    return next;
  }

  const amountPattern = String.raw`(${NUMBER_PATTERN}\s*(?:million|thousand|m|k)?)`;
  const maxMatch = normalized.match(
    new RegExp(String.raw`(?:under|below|up to|no more than|not more than|maximum|max(?:imum)?(?: price)?(?: of)?)\s+${amountPattern}`, "i"),
  );
  if (maxMatch) {
    const max = parseMoney(maxMatch[1]);
    if (max !== undefined) next.maxPrice = Math.min(next.maxPrice ?? Number.MAX_SAFE_INTEGER, max);
  }

  const minMatch = normalized.match(
    new RegExp(String.raw`(?:over|above|at least|minimum|min(?:imum)?(?: price)?(?: of)?)\s+${amountPattern}`, "i"),
  );
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
  const withRadius = extractRadius(query, withBeds);
  const patch: SearchFilters = {};

  for (const key of [
    "minPrice",
    "maxPrice",
    "minBeds",
    "maxBeds",
    "minRadiusMiles",
    "radiusMiles",
  ] as const) {
    const value = withRadius[key];
    if (value !== undefined) patch[key] = value;
  }

  return patch;
}

/**
 * Explicit constraints in the current query replace stale values for the same
 * filter dimension, while unrelated UI filters remain active. Without this,
 * a previous 1-mile UI radius could be intersected with a new 1.5-2.4-mile
 * query (producing an impossible 1.5-to-1 range), or a previous AED 1m cap
 * could conflict with a new AED 2m-2.5m range.
 */
function applyExplicitQueryFilters(query: string, filters: SearchFilters): SearchFilters {
  const next: SearchFilters = { ...filters };

  const pricePatch = extractPrice(query, {});
  if (pricePatch.minPrice !== undefined || pricePatch.maxPrice !== undefined) {
    delete next.minPrice;
    delete next.maxPrice;
    if (pricePatch.minPrice !== undefined) next.minPrice = pricePatch.minPrice;
    if (pricePatch.maxPrice !== undefined) next.maxPrice = pricePatch.maxPrice;
  }

  const bedPatch = extractBeds(query, {});
  if (bedPatch.minBeds !== undefined || bedPatch.maxBeds !== undefined) {
    delete next.minBeds;
    delete next.maxBeds;
    if (bedPatch.minBeds !== undefined) next.minBeds = bedPatch.minBeds;
    if (bedPatch.maxBeds !== undefined) next.maxBeds = bedPatch.maxBeds;
  }

  const radiusPatch = extractRadius(query, {});
  if (radiusPatch.minRadiusMiles !== undefined || radiusPatch.radiusMiles !== undefined) {
    delete next.minRadiusMiles;
    delete next.radiusMiles;
    if (radiusPatch.minRadiusMiles !== undefined) next.minRadiusMiles = radiusPatch.minRadiusMiles;
    if (radiusPatch.radiusMiles !== undefined) next.radiusMiles = radiusPatch.radiusMiles;
  }

  return next;
}

export function understandQuery(query: string, filters: SearchFilters): QueryPlan {
  const normalized = normalize(query);
  const nextFilters = applyExplicitQueryFilters(normalized, filters);
  const hardConstraints: string[] = [];

  const hasRadiusInQuery = /\b(?:within|radius|miles?|mi|kilometers?|kilometres?|km)\b/i.test(normalized);
  if (hasRadiusInQuery && nextFilters.radiusMiles !== undefined) {
    if (nextFilters.minRadiusMiles !== undefined && nextFilters.minRadiusMiles > 0) {
      hardConstraints.push(`distance between ${nextFilters.minRadiusMiles} and ${nextFilters.radiusMiles} miles`);
    } else {
      hardConstraints.push(`radius <= ${nextFilters.radiusMiles} miles`);
    }
  }

  if (nextFilters.minPrice !== undefined) hardConstraints.push(`price >= AED ${nextFilters.minPrice}`);
  if (nextFilters.maxPrice !== undefined) hardConstraints.push(`price <= AED ${nextFilters.maxPrice}`);

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

  // Explicit facts are sent to SQL as structured constraints rather than
  // relying on an embedding to infer numeric ranges.
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
