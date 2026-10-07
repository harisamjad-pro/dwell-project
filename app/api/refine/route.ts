import { NextResponse } from "next/server";
import { z } from "zod";
import { chatJson } from "@/lib/ollama";
import { buildRefinementMessages } from "@/lib/prompts";

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

export async function POST(request: Request) {
  try {
    const body = requestSchema.parse(await request.json());
    const data = responseSchema.parse(
      await chatJson<unknown>(buildRefinementMessages(body.query, body.followUp, body.filters)),
    );

    return NextResponse.json(data);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unexpected refinement error.";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
