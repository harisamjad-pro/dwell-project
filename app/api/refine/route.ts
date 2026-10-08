import { NextResponse } from "next/server";
import { z } from "zod";
import { chatJson } from "@/lib/ollama";
import { buildRefinementMessages } from "@/lib/prompts";
import { extractExplicitFilterPatch } from "@/lib/query-understanding";

export const runtime = "nodejs";

const requestSchema = z.object({
  query: z.string().min(1).max(600),
  followUp: z.string().min(2).max(500),
  filters: z.record(z.string(), z.unknown()).default({}),
});

const responseSchema = z.object({
  query: z.string().min(3).max(700),
  filterPatch: z.record(z.string(), z.unknown()).default({}),
});

const filterPatchSchema = z.object({
  minPrice: z.coerce.number().int().nonnegative().optional(),
  maxPrice: z.coerce.number().int().nonnegative().optional(),
  minBeds: z.coerce.number().int().nonnegative().optional(),
  maxBeds: z.coerce.number().int().nonnegative().optional(),
  locationText: z.string().trim().min(1).max(100).optional(),
}).strict();

export async function POST(request: Request) {
  try {
    const body = requestSchema.parse(await request.json());
    const deterministicPatch = extractExplicitFilterPatch(body.followUp);

    let llmData: z.infer<typeof responseSchema> | null = null;
    try {
      llmData = responseSchema.parse(
        await chatJson<unknown>(buildRefinementMessages(body.query, body.followUp, body.filters)),
      );
    } catch {
      // Explicit numeric filters do not depend on the LLM. A refinement such as
      // "not more than 8M" must still work if the model is temporarily unavailable.
      llmData = null;
    }

    const llmPatchResult = filterPatchSchema.safeParse(llmData?.filterPatch ?? {});
    const llmPatch = llmPatchResult.success ? llmPatchResult.data : {};
    const filterPatch = { ...llmPatch, ...deterministicPatch };

    const query =
      llmData?.query?.trim() ||
      `${body.query.trim()} ${body.followUp.trim()}`.trim();

    return NextResponse.json({ query, filterPatch });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unexpected refinement error.";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
