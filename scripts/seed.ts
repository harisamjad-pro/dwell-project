import fs from "node:fs/promises";
import path from "node:path";
import { z } from "zod";
import { getAdminSupabase } from "../lib/supabase";
import { embedText } from "../lib/ollama";

const listingSchema = z.object({
  title: z.string(),
  price: z.number().int(),
  bedrooms: z.number().int(),
  bathrooms: z.number().int(),
  propertyType: z.string(),
  city: z.string(),
  area: z.string(),
  summary: z.string(),
  description: z.string(),
  imageUrl: z.string().url(),
  latitude: z.number(),
  longitude: z.number(),
});

const payload = z.array(listingSchema);

function chunkText(text: string, maxWords = 90) {
  const paragraphs = text.split(/\s+/).filter(Boolean);
  const chunks: string[] = [];
  for (let i = 0; i < paragraphs.length; i += maxWords) {
    chunks.push(paragraphs.slice(i, i + maxWords).join(" "));
  }
  return chunks;
}

async function main() {
  const file = path.join(process.cwd(), "data", "listings.json");
  const raw = JSON.parse(await fs.readFile(file, "utf8"));
  const listings = payload.parse(raw);
  const supabase = getAdminSupabase();

  console.log(`Resetting Dwell demo data…`);
  await supabase.from("listing_chunks").delete().neq("id", 0);
  await supabase.from("listings").delete().neq("title", "__never__");

  for (const [index, listing] of listings.entries()) {
    const { data: inserted, error } = await supabase
      .from("listings")
      .insert({
        title: listing.title,
        price: listing.price,
        bedrooms: listing.bedrooms,
        bathrooms: listing.bathrooms,
        property_type: listing.propertyType,
        city: listing.city,
        area: listing.area,
        summary: listing.summary,
        description: listing.description,
        image_url: listing.imageUrl,
        latitude: listing.latitude,
        longitude: listing.longitude,
      })
      .select("id")
      .single();

    if (error || !inserted) throw new Error(`Listing insert failed: ${error?.message}`);

    const chunks = chunkText(listing.description);
    const embeddings = await embedText(chunks);

    const rows = chunks.map((content, chunkIndex) => ({
      listing_id: inserted.id,
      chunk_index: chunkIndex,
      content,
      embedding: embeddings[chunkIndex],
    }));

    const { error: chunkError } = await supabase.from("listing_chunks").insert(rows);
    if (chunkError) throw new Error(`Chunk insert failed: ${chunkError.message}`);

    console.log(`${index + 1}/${listings.length} indexed: ${listing.title} (${chunks.length} chunks)`);
  }

  console.log("Dwell demo dataset is ready.");
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
