import { z } from "zod";
import { getSupabase } from "./supabase";
import { embedText, chatJson } from "./ollama";
import { buildExplanationMessages } from "./prompts";
import type { Listing, SearchFilters } from "./types";
import { env } from "./env";

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
const MIN_MATCH_SCORE = 0.46;

export async function semanticSearch(
  query: string,
  filters: SearchFilters,
): Promise<{
  results: Listing[];
  explanations: { listingId: string; reasons: string[] }[];
}> {
  const [embedding] = await embedText(query);
  if (!embedding) throw new Error("Failed to create a query embedding.");

  const supabase = getSupabase();
  const { data, error } = await supabase.rpc("search_dwell_listings", {
    query_embedding: embedding,
    query_text: query,
    min_price: filters.minPrice ?? null,
    max_price: filters.maxPrice ?? null,
    min_beds: filters.minBeds ?? null,
    max_beds: filters.maxBeds ?? null,
    location_text: filters.locationText?.trim() || null,
    center_lat: filters.lat ?? null,
    center_lng: filters.lng ?? null,
    radius_miles: filters.radiusMiles ?? null,
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
  }));

  if (results.length === 0) return { results, explanations: [] };

  let explanations: { listingId: string; reasons: string[] }[] = [];
  try {
    const response = await chatJson<unknown>(
      buildExplanationMessages(query, results.slice(0, 8)),
    );
    explanations = explanationSchema.parse(response).explanations;
  } catch {
    explanations = results.map((listing) => ({
      listingId: listing.id,
      reasons: [
        "Semantic match: the listing contains concepts close to your search.",
        `Evidence: “${(listing.matchedChunk ?? listing.summary).slice(0, 120)}”`,
      ],
    }));
  }

  return { results, explanations };
}

export const searchConfig = {
  embeddingModel: env.OLLAMA_EMBEDDING_MODEL,
  llmModel: env.OLLAMA_LLM_MODEL,
  resultLimit: RESULT_LIMIT,
  minMatchScore: MIN_MATCH_SCORE,
};
