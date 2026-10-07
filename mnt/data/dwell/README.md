# Dwell — natural-language property search

Dwell is a Next.js + Supabase MVP for semantic property discovery. The core idea is simple: a user describes the kind of home they actually want, and the system ranks listings by meaning while still honoring hard constraints like price, bedrooms, area, and radius.

## Architecture

- **Next.js 16 + TypeScript** — UI and server routes.
- **Supabase Postgres + pgvector + PostGIS** — listing storage, vector search, and radius filtering.
- **Ollama embedding model** — `qwen3-embedding:0.6b` by default, producing 1024-dimensional normalized vectors.
- **Ollama Cloud LLM** — `gemma4:31b` via Ollama Cloud for match explanations and conversational refinement.
- **No OpenAI / Claude / Voyage dependency.**

Ollama currently separates its embedding model catalog from its listed cloud reasoning models. The project therefore keeps embeddings on Ollama too, with a configurable endpoint, while using Ollama Cloud for the LLM layer. See `.env.example`.

## 1. Create Supabase project

Create a Supabase project and run `supabase/migrations/001_dwell.sql` in the SQL editor.

This enables `vector` and `postgis`, creates `listings` and `listing_chunks`, adds an HNSW cosine index, and creates the `search_dwell_listings(...)` RPC. The RPC is the key hybrid search path: it applies structured filters and vector similarity in one SQL query, with the best matching chunk representing each listing.

## 2. Configure environment

Copy `.env.example` to `.env.local` and fill in:

```bash
NEXT_PUBLIC_SUPABASE_URL=...
NEXT_PUBLIC_SUPABASE_ANON_KEY=...
SUPABASE_SERVICE_ROLE_KEY=...
OLLAMA_API_KEY=...
```

For Ollama Cloud, keep `OLLAMA_LLM_URL=https://ollama.com/api` and use `OLLAMA_LLM_MODEL=gemma4:31b`. If you instead route the chat request through a local Ollama daemon, set the model to the local cloud tag, e.g. `gemma4:31b-cloud`.

For embeddings, install Ollama and pull the default model:

```bash
ollama pull qwen3-embedding:0.6b
```

You can switch to a stronger Qwen3 Embedding size later, but the SQL column and index dimension must match the output dimension you configure.

## 3. Install and seed

```bash
npm install
npm run db:seed
```

The seed script loads the synthetic dataset in `data/listings.json`, chunks each description, generates embeddings **once per chunk**, and writes them to Supabase. Re-running the script resets the demo dataset so it is safe for local development.

## 4. Start the app

```bash
npm run dev
```

Open http://localhost:3000.

## Search flow

1. User enters natural-language requirements.
2. Next.js embeds only that user query.
3. Supabase RPC runs the vector cosine search over precomputed listing chunks.
4. The same SQL query applies price, beds, area and optional radius constraints.
5. The top listings are passed to Ollama Cloud for concise, evidence-based match explanations.
6. A follow-up such as “actually, I need a dedicated home office” goes through the refinement route; the model rewrites the query and extracts any explicit hard-filter changes, then the normal search flow runs again.

## Honest limitation

Semantic similarity is relevance, not truth. A listing that says “away from city noise” can still be imperfectly matched to “quiet.” Dwell intentionally surfaces the evidence behind the match so users can inspect why a result appeared rather than treating an opaque semantic score as a fact.

## Suggested production upgrades

- Add authentication and saved searches.
- Add a proper location-picker/geocoding layer for radius searches.
- Use a managed/background ingestion worker for large listing feeds.
- Add lexical / hybrid score blending only after measuring whether exact phrase matches improve ranking for your dataset.
- Store a versioned embedding model identifier so re-indexing is explicit when the model changes.
