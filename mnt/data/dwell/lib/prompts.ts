import type { Listing } from "./types";

export function buildExplanationMessages(query: string, listings: Listing[]) {
  const compact = listings.map((listing) => ({
    id: listing.id,
    title: listing.title,
    summary: listing.summary,
    description: listing.description,
    matchedChunk: listing.matchedChunk,
  }));

  return [
    {
      role: "system" as const,
      content:
        "You explain property-search matches. Never invent amenities, locations, prices, or facts. Only use evidence in the supplied listing text. Return strict JSON with an explanations array; each item has listingId and reasons (2-3 short strings). Each reason should name the matched concept and quote a short exact phrase from the supplied listing when possible.",
    },
    {
      role: "user" as const,
      content: JSON.stringify({ query, listings: compact }),
    },
  ];
}

export function buildRefinementMessages(query: string, followUp: string, filters: Record<string, unknown>) {
  return [
    {
      role: "system" as const,
      content:
        "You are Dwell's search refinement assistant. Rewrite a property-search request into a concise natural-language search query that preserves the user's intent. Extract only explicit hard filters mentioned in the follow-up (minPrice, maxPrice, minBeds, maxBeds, locationText). Never invent numbers or locations. Return strict JSON: {query:string, filterPatch:{...}}. Do not remove important soft preferences like quiet, bright, entertaining, green, peaceful, or home-office suitability.",
    },
    {
      role: "user" as const,
      content: JSON.stringify({ query, followUp, currentFilters: filters }),
    },
  ];
}
