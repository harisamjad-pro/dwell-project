import { NextResponse } from "next/server";
import { z } from "zod";
import { semanticSearch, searchConfig } from "@/lib/search";

export const runtime = "nodejs";

const schema = z.object({
  query: z.string().trim().min(3).max(600),
  filters: z.object({
    minPrice: z.number().int().nonnegative().optional(),
    maxPrice: z.number().int().nonnegative().optional(),
    minBeds: z.number().int().nonnegative().optional(),
    maxBeds: z.number().int().nonnegative().optional(),
    locationText: z.string().max(100).optional(),
    lat: z.number().optional(),
    lng: z.number().optional(),
    minRadiusMiles: z.number().positive().max(100).optional(),
    radiusMiles: z.number().positive().max(100).optional(),
  }).default({}),
});

export async function POST(request: Request) {
  try {
    const body = schema.parse(await request.json());
    const { results, explanations } = await semanticSearch(body.query, body.filters);

    return NextResponse.json({
      query: body.query,
      results,
      explanations,
      meta: { count: results.length, model: searchConfig.llmModel },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unexpected search error.";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
