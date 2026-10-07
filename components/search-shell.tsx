"use client";

import { useMemo, useState } from "react";
import { ArrowUpRight, ChevronDown, Loader2, Search, SlidersHorizontal, Sparkles, WandSparkles } from "lucide-react";
import { ListingCard } from "./listing-card";
import type { SearchFilters, SearchResponse } from "@/lib/types";

const suggestions = [
  "A quiet family villa near good schools, not on a main road, bright kitchen, room for two cars",
  "A bright home for entertaining with a proper office and some greenery nearby",
  "Peaceful townhouse with natural light, a garden and easy school runs",
];

const defaultFilters: SearchFilters = {};

const areaCenters: Record<string, { lat: number; lng: number }> = {
  "Jumeirah Park": { lat: 25.0414, lng: 55.1536 },
  "Arabian Ranches": { lat: 25.0576, lng: 55.2708 },
  "The Springs": { lat: 25.0628, lng: 55.2018 },
  "Mirdif": { lat: 25.2339, lng: 55.4212 },
  "Al Barsha": { lat: 25.1121, lng: 55.2015 },
  "Jumeirah": { lat: 25.2048, lng: 55.2708 },
  "Mudon": { lat: 25.0147, lng: 55.3271 },
  "Town Square": { lat: 25.0034, lng: 55.2921 },
  "Dubai Creek Harbour": { lat: 25.2063, lng: 55.3435 },
  "Al Safa": { lat: 25.1812, lng: 55.2361 },
};


export function SearchShell() {
  const [query, setQuery] = useState("");
  const [draftQuery, setDraftQuery] = useState(suggestions[0]);
  const [filters, setFilters] = useState<SearchFilters>(defaultFilters);
  const [results, setResults] = useState<SearchResponse | null>(null);
  const [busy, setBusy] = useState(false);
  const [refining, setRefining] = useState(false);
  const [refinement, setRefinement] = useState("");
  const [showFilters, setShowFilters] = useState(false);
  const [error, setError] = useState("");

  const explanationMap = useMemo(
    () => new Map((results?.explanations ?? []).map((item) => [item.listingId, item.reasons])),
    [results],
  );

  async function runSearch(nextQuery = draftQuery, nextFilters = filters) {
    if (!nextQuery.trim()) return;
    setBusy(true);
    setError("");
    try {
      const response = await fetch("/api/search", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ query: nextQuery, filters: nextFilters }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Search failed");
      setResults(data);
      setQuery(nextQuery);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Search failed");
    } finally {
      setBusy(false);
    }
  }

  async function refine() {
    if (!refinement.trim() || !query) return;
    setRefining(true);
    setError("");
    try {
      const response = await fetch("/api/refine", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ query, followUp: refinement, filters }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Refinement failed");
      const patch = data.filterPatch ?? {};
      const nextFilters = { ...filters, ...patch } as SearchFilters;
      setFilters(nextFilters);
      setDraftQuery(data.query);
      setRefinement("");
      await runSearch(data.query, nextFilters);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Refinement failed");
    } finally {
      setRefining(false);
    }
  }

  return (
    <main className="min-h-screen">
      <header className="mx-auto flex max-w-7xl items-center justify-between px-5 py-6 sm:px-8">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-[#2f4736] text-white shadow-lg shadow-black/5">D</div>
          <div>
            <div className="text-[15px] font-semibold tracking-[-0.02em]">Dwell</div>
            <div className="text-xs text-[#7a7d77]">Search for how a home feels</div>
          </div>
        </div>
        <div className="hidden items-center gap-6 text-sm text-[#737770] sm:flex">
          <span>Semantic search</span>
          <span>Transparent matches</span>
          <span className="rounded-full border border-[#dad7ce] bg-white/60 px-3 py-1.5 text-xs">PropTech MVP</span>
        </div>
      </header>

      <section className="mx-auto max-w-7xl px-5 pb-14 pt-10 sm:px-8 sm:pt-14">
        <div className="max-w-4xl">
          <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.16em] text-[#6a7c6f]">
            <Sparkles size={14} /> Natural-language property discovery
          </div>
          <h1 className="mt-5 text-[46px] font-semibold leading-[1.02] tracking-[-0.05em] text-[#1d2520] sm:text-[72px]">
            Tell Dwell what you want.
            <span className="block text-[#627365]">Not what a dropdown asks.</span>
          </h1>
          <p className="mt-5 max-w-2xl text-[17px] leading-7 text-[#697069]">
            Describe the feeling, the trade-offs and the details that usually disappear inside property filters. Dwell ranks listings by meaning, then shows the evidence behind the match.
          </p>
        </div>

        <div className="mt-10 grid gap-6 lg:grid-cols-[minmax(0,1fr)_320px]">
          <div className="dwell-card rounded-[30px] p-4 sm:p-5">
            <div className="rounded-[24px] border border-[#dedbd2] bg-white/80 p-3 focus-within:border-[#8ea494]">
              <textarea
                value={draftQuery}
                onChange={(event) => setDraftQuery(event.target.value)}
                rows={4}
                className="w-full resize-none border-none bg-transparent px-3 py-2 text-[17px] leading-7 outline-none placeholder:text-[#a4a7a1]"
                placeholder="A quiet family villa near good schools, not on a main road…"
              />
              <div className="mt-2 flex flex-wrap items-center justify-between gap-3">
                <div className="flex flex-wrap gap-2">
                  {suggestions.map((suggestion) => (
                    <button
                      type="button"
                      key={suggestion}
                      onClick={() => setDraftQuery(suggestion)}
                      className="rounded-full border border-[#dfddd6] bg-[#faf9f6] px-3 py-1.5 text-left text-xs text-[#656b65] transition hover:border-[#a9b8ad] hover:bg-[#f0f5f0]"
                    >
                      {suggestion.slice(0, 46)}…
                    </button>
                  ))}
                </div>
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => runSearch()}
                  className="inline-flex h-11 items-center gap-2 rounded-2xl bg-[#2f4736] px-5 text-sm font-semibold text-white transition hover:bg-[#243b2b] disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {busy ? <Loader2 size={16} className="animate-spin" /> : <Search size={16} />}
                  Search homes
                </button>
              </div>
            </div>

            <div className="mt-3 flex items-center justify-between gap-3 px-1 text-xs text-[#777b75]">
              <span>Semantic similarity + hard filters in one Postgres query</span>
              <button type="button" onClick={() => setShowFilters((value) => !value)} className="inline-flex items-center gap-1.5 font-semibold text-[#4f5e53]">
                <SlidersHorizontal size={14} /> Filters <ChevronDown size={14} className={showFilters ? "rotate-180" : ""} />
              </button>
            </div>

            {showFilters && (
              <div className="mt-4 grid gap-3 rounded-2xl border border-[#e1ded6] bg-[#fbfaf7] p-4 sm:grid-cols-2 lg:grid-cols-4">
                <FilterInput label="Min price" value={filters.minPrice} onChange={(value) => setFilters((f) => ({ ...f, minPrice: value }))} />
                <FilterInput label="Max price" value={filters.maxPrice} onChange={(value) => setFilters((f) => ({ ...f, maxPrice: value }))} />
                <FilterInput label="Min beds" value={filters.minBeds} onChange={(value) => setFilters((f) => ({ ...f, minBeds: value }))} />
                <FilterInput label="Max beds" value={filters.maxBeds} onChange={(value) => setFilters((f) => ({ ...f, maxBeds: value }))} />
                <div className="sm:col-span-2">
                  <label className="mb-1.5 block text-xs font-semibold text-[#6c716b]">Area / city</label>
                  <input
                    value={filters.locationText ?? ""}
                    onChange={(e) => {
                      const value = e.target.value;
                      const center = areaCenters[value];
                      setFilters((f) => ({
                        ...f,
                        locationText: value || undefined,
                        lat: center?.lat,
                        lng: center?.lng,
                      }));
                    }}
                    placeholder="e.g. Jumeirah"
                    className="h-10 w-full rounded-xl border border-[#dedbd2] bg-white px-3 text-sm outline-none focus:border-[#92a697]"
                  />
                </div>
                <div>
                  <label className="mb-1.5 block text-xs font-semibold text-[#6c716b]">Radius (miles)</label>
                  <input
                    type="number"
                    min={1}
                    max={100}
                    value={filters.radiusMiles ?? ""}
                    onChange={(e) => setFilters((f) => ({ ...f, radiusMiles: e.target.value ? Number(e.target.value) : undefined }))}
                    placeholder="10"
                    className="h-10 w-full rounded-xl border border-[#dedbd2] bg-white px-3 text-sm outline-none focus:border-[#92a697]"
                  />
                  <div className="mt-1 text-[10px] leading-4 text-[#898d87]">Uses the demo area's center when a known area is selected.</div>
                </div>
                <div className="flex items-end">
                  <button
                    type="button"
                    onClick={() => setFilters(defaultFilters)}
                    className="h-10 w-full rounded-xl border border-[#dedbd2] bg-white text-sm font-medium text-[#636860]"
                  >
                    Reset filters
                  </button>
                </div>
              </div>
            )}
          </div>

          <aside className="dwell-card rounded-[28px] p-5 sm:p-6">
            <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.14em] text-[#6a7c6f]">
              <WandSparkles size={14} /> Refine in plain language
            </div>
            <p className="mt-3 text-sm leading-6 text-[#70756f]">
              After a result set appears, keep talking. Dwell rewrites the request and re-runs the semantic search.
            </p>
            <div className="mt-5 rounded-2xl border border-[#dedbd2] bg-white/80 p-3">
              <input
                value={refinement}
                onChange={(e) => setRefinement(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Enter") void refine(); }}
                placeholder="Actually, I need a dedicated office"
                className="w-full bg-transparent px-1 py-2 text-sm outline-none placeholder:text-[#a1a49f]"
                disabled={!query}
              />
              <button
                type="button"
                onClick={() => void refine()}
                disabled={!query || !refinement.trim() || refining}
                className="mt-2 inline-flex h-10 w-full items-center justify-center gap-2 rounded-xl bg-[#edf2eb] text-sm font-semibold text-[#3e5c47] disabled:opacity-45"
              >
                {refining ? <Loader2 size={15} className="animate-spin" /> : <ArrowUpRight size={15} />}
                Apply refinement
              </button>
            </div>
            <div className="mt-5 border-t border-[#e4e1da] pt-4 text-xs leading-5 text-[#7a7f79]">
              Dwell does not treat semantic relevance as proof. The match panel is there so you can sanity-check the evidence in the listing itself.
            </div>
          </aside>
        </div>

        {error && <div className="mt-6 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>}

        <div className="mt-10">
          {results ? (
            <>
              <div className="flex items-end justify-between gap-4">
                <div>
                  <div className="text-xs font-semibold uppercase tracking-[0.14em] text-[#748076]">Ranked results</div>
                  <h2 className="mt-2 text-2xl font-semibold tracking-[-0.03em]">{results.results.length} homes matched your description</h2>
                  <p className="mt-1 text-sm text-[#737871]">Searched for “{results.query}”</p>
                </div>
                <div className="hidden rounded-full border border-[#dcd9d1] bg-white/65 px-3 py-1.5 text-xs text-[#6c736c] sm:block">Only strong matches · semantic rank</div>
              </div>

              {results.results.length > 0 ? (
                <div className="mt-6 grid gap-5 xl:grid-cols-2">
                  {results.results.map((listing, index) => (
                    <div key={listing.id} className="animate-enter" style={{ animationDelay: `${index * 50}ms` }}>
                      <ListingCard listing={listing} reasons={explanationMap.get(listing.id) ?? ["Semantic match to the themes in your search."]} />
                    </div>
                  ))}
                </div>
              ) : (
                <div className="mt-6 rounded-[28px] border border-dashed border-[#cecac0] bg-white/45 p-10 text-center">
                  <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-[#edf2eb] text-[#48624f]"><Search size={18} /></div>
                  <h3 className="mt-4 text-lg font-semibold">No strong semantic matches.</h3>
                  <p className="mt-2 text-sm text-[#737871]">Try rephrasing the description, or loosen price, beds, area, or radius. Dwell intentionally does not fill the list with weak matches.</p>
                </div>
              )}
            </>
          ) : (
            <div className="rounded-[30px] border border-[#dedbd2] bg-white/35 p-8 sm:p-10">
              <div className="grid gap-8 lg:grid-cols-[1fr_1fr] lg:items-center">
                <div>
                  <div className="text-xs font-semibold uppercase tracking-[0.14em] text-[#7a857d]">What makes this different</div>
                  <h2 className="mt-3 text-3xl font-semibold tracking-[-0.04em]">Meaning first. Filters second.</h2>
                  <p className="mt-4 max-w-xl text-sm leading-6 text-[#70766f]">
                    The listing descriptions are chunked and embedded once during ingestion. Searches only embed the user's query, then Postgres finds the nearest matching chunks while applying hard filters in the same SQL function.
                  </p>
                </div>
                <div className="grid gap-3 sm:grid-cols-3 lg:grid-cols-1">
                  {[
                    ["01", "Describe", "Quiet, bright, good for entertaining, dedicated office…"],
                    ["02", "Rank", "pgvector cosine similarity + structured WHERE constraints"],
                    ["03", "Explain", "Short evidence-backed reasons for every result"],
                  ].map(([number, title, text]) => (
                    <div key={number} className="rounded-2xl border border-[#e1ded7] bg-white/55 p-4">
                      <div className="text-xs font-semibold text-[#7d8a7f]">{number}</div>
                      <div className="mt-1 font-semibold">{title}</div>
                      <div className="mt-1 text-xs leading-5 text-[#757b74]">{text}</div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}
        </div>
      </section>
    </main>
  );
}

function FilterInput({ label, value, onChange }: { label: string; value?: number; onChange: (value?: number) => void }) {
  return (
    <div>
      <label className="mb-1.5 block text-xs font-semibold text-[#6c716b]">{label}</label>
      <input
        type="number"
        min={0}
        value={value ?? ""}
        onChange={(e) => onChange(e.target.value ? Number(e.target.value) : undefined)}
        className="h-10 w-full rounded-xl border border-[#dedbd2] bg-white px-3 text-sm outline-none focus:border-[#92a697]"
      />
    </div>
  );
}
