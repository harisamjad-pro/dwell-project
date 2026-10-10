export type SearchFilters = {
  minPrice?: number;
  maxPrice?: number;
  minBeds?: number;
  maxBeds?: number;
  locationText?: string;
  lat?: number;
  lng?: number;
  minRadiusMiles?: number;
  radiusMiles?: number;
};

export type Listing = {
  id: string;
  title: string;
  price: number;
  bedrooms: number;
  bathrooms: number;
  propertyType: string;
  city: string;
  area: string;
  summary: string;
  description: string;
  imageUrl: string;
  latitude: number;
  longitude: number;
  semanticScore: number;
  matchedChunk?: string;
  matchedSignals?: string[];
  distanceMiles?: number;
  distanceOrigin?: string;
  minRadiusMiles?: number;
  radiusMiles?: number;
};

export type MatchExplanation = {
  listingId: string;
  reasons: string[];
};

export type SearchResponse = {
  query: string;
  results: Listing[];
  explanations: MatchExplanation[];
  meta: { count: number; model: string };
};
