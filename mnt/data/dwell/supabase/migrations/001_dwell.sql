create extension if not exists vector with schema extensions;
create extension if not exists postgis with schema extensions;

create table if not exists public.listings (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  price integer not null,
  bedrooms integer not null,
  bathrooms integer not null,
  property_type text not null,
  city text not null,
  area text not null,
  summary text not null,
  description text not null,
  image_url text not null,
  latitude double precision not null,
  longitude double precision not null,
  created_at timestamptz not null default now()
);

create table if not exists public.listing_chunks (
  id bigint generated always as identity primary key,
  listing_id uuid not null references public.listings(id) on delete cascade,
  chunk_index integer not null,
  content text not null,
  embedding vector(1024) not null,
  created_at timestamptz not null default now(),
  unique(listing_id, chunk_index)
);

create index if not exists listings_area_idx on public.listings (area);
create index if not exists listings_price_idx on public.listings (price);
create index if not exists listings_bedrooms_idx on public.listings (bedrooms);
create index if not exists listing_chunks_listing_id_idx on public.listing_chunks (listing_id);
create index if not exists listing_chunks_embedding_hnsw_idx
  on public.listing_chunks using hnsw (embedding vector_cosine_ops);

alter table public.listings enable row level security;
alter table public.listing_chunks enable row level security;

drop policy if exists "Public can read listings" on public.listings;
create policy "Public can read listings"
  on public.listings for select using (true);

drop policy if exists "Public can read listing chunks" on public.listing_chunks;
create policy "Public can read listing chunks"
  on public.listing_chunks for select using (true);

create or replace function public.search_dwell_listings(
  query_embedding vector(1024),
  min_price integer default null,
  max_price integer default null,
  min_beds integer default null,
  max_beds integer default null,
  location_text text default null,
  center_lat double precision default null,
  center_lng double precision default null,
  radius_miles double precision default null,
  result_limit integer default 8
)
returns table (
  id uuid,
  title text,
  price integer,
  bedrooms integer,
  bathrooms integer,
  property_type text,
  city text,
  area text,
  summary text,
  description text,
  image_url text,
  latitude double precision,
  longitude double precision,
  semantic_score double precision,
  matched_chunk text
)
language sql
stable
security definer
set search_path = public, extensions
as $$
  with eligible as (
    select
      l.id,
      l.title,
      l.price,
      l.bedrooms,
      l.bathrooms,
      l.property_type,
      l.city,
      l.area,
      l.summary,
      l.description,
      l.image_url,
      l.latitude,
      l.longitude,
      c.content as matched_chunk,
      1 - (c.embedding <=> query_embedding) as semantic_score,
      row_number() over (
        partition by l.id
        order by c.embedding <=> query_embedding
      ) as rn
    from public.listings l
    join public.listing_chunks c on c.listing_id = l.id
    where (min_price is null or l.price >= min_price)
      and (max_price is null or l.price <= max_price)
      and (min_beds is null or l.bedrooms >= min_beds)
      and (max_beds is null or l.bedrooms <= max_beds)
      and (location_text is null or lower(l.area) like '%' || lower(location_text) || '%' or lower(l.city) like '%' || lower(location_text) || '%')
      and (
        center_lat is null or center_lng is null or radius_miles is null
        or extensions.st_dwithin(
          extensions.geography(extensions.st_makepoint(l.longitude, l.latitude)),
          extensions.geography(extensions.st_makepoint(center_lng, center_lat)),
          radius_miles * 1609.344
        )
      )
  )
  select
    id,
    title,
    price,
    bedrooms,
    bathrooms,
    property_type,
    city,
    area,
    summary,
    description,
    image_url,
    latitude,
    longitude,
    semantic_score,
    matched_chunk
  from eligible
  where rn = 1
  order by semantic_score desc
  limit greatest(1, least(result_limit, 25));
$$;

grant execute on function public.search_dwell_listings(
  vector(1024), integer, integer, integer, integer, text, double precision, double precision, double precision, integer
) to anon, authenticated;
