"use client";

import { MapPin, Navigation, Sparkles } from "lucide-react";
import type { Listing } from "@/lib/types";

function money(value: number) {
  return new Intl.NumberFormat("en-AE", { maximumFractionDigits: 0 }).format(value);
}

function distanceLabel(distance: number) {
  if (distance < 0.1) return "Very close · under 0.1 mi";
  if (distance < 1) return `${distance.toFixed(1)} mi · very nearby`;
  if (distance < 3) return `${distance.toFixed(1)} mi · nearby`;
  if (distance < 5) return `${distance.toFixed(1)} mi · a little farther`;
  return `${distance.toFixed(1)} mi · farther away`;
}

export function ListingCard({ listing, reasons }: { listing: Listing; reasons: string[] }) {
  return (
    <article className="dwell-card group overflow-hidden rounded-[28px] bg-white/75">
      <div className="relative h-64 overflow-hidden bg-[#ece9e0]">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={listing.imageUrl}
          alt={listing.title}
          className="h-full w-full object-cover transition duration-700 group-hover:scale-[1.03]"
        />
        <div className="absolute left-4 top-4 rounded-full bg-white/85 px-3 py-1.5 text-xs font-medium backdrop-blur">
          {listing.propertyType}
        </div>
        <div className="absolute bottom-4 left-4 rounded-2xl bg-[#1f2923]/90 px-4 py-2.5 text-white backdrop-blur">
          <span className="text-xs text-white/65">AED</span>
          <span className="ml-1.5 text-base font-semibold">{money(listing.price)}</span>
        </div>
      </div>

      <div className="p-5 sm:p-6">
        <div className="flex items-start justify-between gap-5">
          <div>
            <h3 className="text-[20px] font-semibold tracking-[-0.02em]">{listing.title}</h3>
            <div className="mt-1 flex flex-wrap items-center gap-x-4 gap-y-1.5 text-sm text-[#777a74]">
              <span className="inline-flex items-center gap-1.5">
                <MapPin size={15} />
                {listing.area}, {listing.city}
              </span>
              {listing.distanceMiles !== undefined && Number.isFinite(listing.distanceMiles) && (
                <span
                  className="inline-flex items-center gap-1.5 font-medium text-[#4f6756]"
                  title={`Approximate straight-line distance${listing.distanceOrigin ? ` from ${listing.distanceOrigin}` : " from the search reference point"}; not driving distance.`}
                >
                  <Navigation size={14} />
                  {distanceLabel(listing.distanceMiles)}
                </span>
              )}
            </div>
          </div>
          <div className="rounded-2xl bg-[#edf2eb] px-3 py-2 text-right text-xs font-medium text-[#3d5e48]">
            <div>{listing.bedrooms} beds</div>
            <div>{listing.bathrooms} baths</div>
          </div>
        </div>

        {listing.distanceMiles !== undefined && Number.isFinite(listing.distanceMiles) && (
          <div className="mt-3 rounded-xl bg-[#f5f6f1] px-3 py-2 text-xs leading-5 text-[#6b7169]">
            <div>
              Approximate straight-line distance{listing.distanceOrigin ? ` from ${listing.distanceOrigin}` : " from your search point"}.
              {listing.radiusMiles !== undefined && listing.minRadiusMiles !== undefined
                ? ` This result is between ${listing.minRadiusMiles} and ${listing.radiusMiles} miles from the reference point.`
                : listing.radiusMiles !== undefined
                  ? ` This result is within your ${listing.radiusMiles}-mile radius.`
                  : " No radius limit is active; distance is shown for context."}
            </div>
          </div>
        )}

        <p className="mt-4 text-[14px] leading-6 text-[#5f665f]">{listing.summary}</p>

        <div className="mt-5 rounded-2xl border border-[#dce5dc] bg-[#f4f8f3] p-4">
          <div className="flex items-center gap-2 text-[12px] font-semibold uppercase tracking-[0.12em] text-[#4f6756]">
            <Sparkles size={14} /> Why it matched
          </div>
          <ul className="mt-2 space-y-2 text-sm leading-5 text-[#425247]">
            {reasons.slice(0, 3).map((reason) => (
              <li key={reason} className="relative pl-4">
                <span className="absolute left-0 top-[9px] h-1.5 w-1.5 rounded-full bg-[#5c7a63]" />
                {reason}
              </li>
            ))}
          </ul>
        </div>
      </div>
    </article>
  );
}
