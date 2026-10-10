import { z } from "zod";
import { getSupabase } from "./supabase";
import { embedText, chatJson } from "./ollama";
import { buildExplanationMessages } from "./prompts";
import { understandQuery } from "./query-understanding";
import type { Listing, SearchFilters } from "./types";
import { env } from "./env";
import { resolveAreaCenter } from "./area-centers";

const rowSchema = z.object({
  id: z.string(),
  title: z.string(),
  price: z.number(),
  bedrooms: z.number(),
  bathrooms: z.number(),
  property_type: z.string(),
  city: z.string(),
  area: z.string(),
  summary: z.string(),
  description: z.string(),
  image_url: z.string(),
  latitude: z.number(),
  longitude: z.number(),
  semantic_score: z.number(),
  matched_chunk: z.string().nullable().optional(),
  matched_signals: z.array(z.string()).nullable().optional(),
  distance_miles: z.number().nullable().optional(),
});

const explanationSchema = z.object({
  explanations: z.array(
    z.object({
      listingId: z.string(),
      reasons: z.array(z.string().min(1)).min(1).max(4),
    }),
  ),
});

const RESULT_LIMIT = 20;
const MIN_MATCH_SCORE = 0.34;

function escapeRegExp(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/** Remove an area-only location phrase so radius search can retrieve nearby homes. */
function queryForRadiusSearch(query: string, area?: string) {
  if (!area || !new RegExp(`\\b${escapeRegExp(area)}\\b`, "i").test(query)) {
    return query.trim();
  }

  const cleaned = query
    .replace(new RegExp(escapeRegExp(area), "ig"), " ")
    .replace(/\b(?:near|in|at|around|within|close\s+to|close|by|from|to|the|a|an|of|for|sale|homes?|properties?|real\s+estate)\b/gi, " ")
    .replace(/[^\p{L}\p{N}]+/gu, " ")
    .replace(/\s+/g, " ")
    .trim();

  return cleaned || "homes for sale in Dubai";
}


function haversineMiles(lat1: number, lng1: number, lat2: number, lng2: number) {
  const toRadians = (value: number) => (value * Math.PI) / 180;
  const earthRadiusMiles = 3958.7613;
  const dLat = toRadians(lat2 - lat1);
  const dLng = toRadians(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRadians(lat1)) *
      Math.cos(toRadians(lat2)) *
      Math.sin(dLng / 2) ** 2;
  return 2 * earthRadiusMiles * Math.asin(Math.sqrt(a));
}

export async function semanticSearch(
  query: string,
  filters: SearchFilters,
): Promise<{
  results: Listing[];
  explanations: { listingId: string; reasons: string[] }[];
  hardConstraints: string[];
}> {
  const plan = understandQuery(query, filters);
  const locationAnchor = plan.filters.locationText?.trim() || plan.area || plan.city;
  const inferredCenter = resolveAreaCenter(locationAnchor);
  const centerLat = plan.filters.lat ?? inferredCenter?.lat;
  const centerLng = plan.filters.lng ?? inferredCenter?.lng;
  const radiusMiles = plan.filters.radiusMiles;
  const radiusRequested = radiusMiles !== undefined;
  const radiusActive = radiusRequested && centerLat !== undefined && centerLng !== undefined;

  if (radiusRequested && !radiusActive) {
    throw new Error(
      "Radius filtering needs a recognized area. Enter a supported Dubai area in Area / city or include it in your search (for example, Business Bay).",
    );
  }

  const semanticQuery = radiusActive
    ? queryForRadiusSearch(plan.semanticQuery, plan.area)
    : plan.semanticQuery;
  const [embedding] = await embedText(semanticQuery);
  if (!embedding) throw new Error("Failed to create a query embedding.");

  const supabase = getSupabase();
  const { data, error } = await supabase.rpc("search_dwell_listings", {
    query_embedding: embedding,
    query_text: semanticQuery,
    query_property_type: plan.propertyType ?? null,
    query_area: plan.area ?? null,
    query_city: plan.city ?? null,
    min_price: plan.filters.minPrice ?? null,
    max_price: plan.filters.maxPrice ?? null,
    min_beds: plan.filters.minBeds ?? null,
    max_beds: plan.filters.maxBeds ?? null,
    location_text: plan.filters.locationText?.trim() || (radiusActive ? locationAnchor ?? null : null),
    center_lat: centerLat ?? null,
    center_lng: centerLng ?? null,
    radius_miles: radiusMiles ?? null,
    result_limit: RESULT_LIMIT,
    min_match_score: MIN_MATCH_SCORE,
  });

  if (error) throw new Error(error.message);

  const rows = z.array(rowSchema).parse(data ?? []);
  const results = rows.map((row) => ({
    id: row.id,
    title: row.title,
    price: row.price,
    bedrooms: row.bedrooms,
    bathrooms: row.bathrooms,
    propertyType: row.property_type,
    city: row.city,
    area: row.area,
    summary: row.summary,
    description: row.description,
    imageUrl: row.image_url,
    latitude: row.latitude,
    longitude: row.longitude,
    semanticScore: row.semantic_score,
    matchedChunk: row.matched_chunk ?? undefined,
    matchedSignals: row.matched_signals ?? undefined,
    distanceMiles:
      row.distance_miles ??
      (centerLat !== undefined && centerLng !== undefined
        ? haversineMiles(centerLat, centerLng, row.latitude, row.longitude)
        : undefined),
    distanceOrigin: locationAnchor ?? undefined,
    radiusMiles: plan.filters.radiusMiles,
  }));

  if (results.length === 0) return { results, explanations: [], hardConstraints: plan.hardConstraints };

  let explanations: { listingId: string; reasons: string[] }[] = [];
  try {
    const response = await chatJson<unknown>(
      buildExplanationMessages(query, results.slice(0, 8)),
    );
    explanations = explanationSchema.parse(response).explanations;
  } catch {
    explanations = results.slice(0, 8).map((listing) => ({
      listingId: listing.id,
      reasons: [
        ...(listing.matchedSignals ?? []).map((signal) => `Matched: ${signal}`),
        `Evidence: “${(listing.matchedChunk ?? listing.summary).slice(0, 120)}”`,
      ].slice(0, 4),
    }));
  }

  return { results, explanations, hardConstraints: plan.hardConstraints };
}

export const searchConfig = {
  embeddingModel: env.OLLAMA_EMBEDDING_MODEL,
  llmModel: env.OLLAMA_LLM_MODEL,
  resultLimit: RESULT_LIMIT,
  minMatchScore: MIN_MATCH_SCORE,
};
