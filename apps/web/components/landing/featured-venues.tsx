import { ArrowRight, MapPin } from "lucide-react";
import Link from "next/link";
import type { DiscoveryVenue } from "../../lib/api";
import { peso } from "../../lib/format";
import { Badge, CourtLines } from "../ui";

export function FeaturedVenues({ venues }: { venues: DiscoveryVenue[] }) {
  if (venues.length === 0) return null;

  return (
    <section aria-labelledby="featured-venues" className="px-[5vw] py-20">
      <div className="mx-auto max-w-6xl">
        <div className="mb-8 flex flex-wrap items-end justify-between gap-4">
          <div>
            <span className="text-xs font-bold uppercase tracking-widest text-court-700">
              Featured venues
            </span>
            <h2
              className="m-0 mt-2 font-display text-4xl font-bold tracking-tight text-ink-900"
              id="featured-venues"
            >
              Courts ready for your next session
            </h2>
          </div>
          <Link
            className="inline-flex items-center gap-1.5 font-semibold text-court-800 hover:text-court-950"
            href="/courts"
          >
            Browse all courts <ArrowRight aria-hidden="true" size={16} />
          </Link>
        </div>
        <ul className="m-0 grid list-none gap-4 p-0 sm:grid-cols-2 lg:grid-cols-3">
          {venues.slice(0, 6).map((venue) => (
            <li key={venue.id}>
              <Link
                className="group block h-full overflow-hidden rounded-(--radius-card) border border-sand-200 bg-white transition-colors hover:border-court-400"
                href={`/courts/${venue.slug}`}
              >
                <div className="relative flex h-28 items-center justify-center overflow-hidden bg-court-100">
                  <CourtLines
                    className="absolute inset-x-4 top-3 w-[calc(100%-2rem)] text-court-400/50"
                    variant="field"
                  />
                </div>
                <div className="p-5">
                  <div className="flex items-baseline justify-between gap-3">
                    <h3 className="m-0 text-lg font-semibold text-ink-900">{venue.name}</h3>
                    {venue.fromPrice !== null ? (
                      <span className="tnum whitespace-nowrap text-sm font-semibold text-court-800">
                        from {peso(venue.fromPrice)}/hr
                      </span>
                    ) : null}
                  </div>
                  <p className="m-0 mt-1 flex items-center gap-1 text-sm text-ink-500">
                    <MapPin aria-hidden="true" size={14} />
                    {venue.cityMunicipality}
                  </p>
                  {venue.amenities.length > 0 ? (
                    <div className="mt-3 flex flex-wrap gap-1.5">
                      {venue.amenities.slice(0, 3).map((amenity) => (
                        <Badge key={amenity}>{amenity.replace(/_/g, " ").toLowerCase()}</Badge>
                      ))}
                      {venue.amenities.length > 3 ? (
                        <Badge>+{venue.amenities.length - 3} more</Badge>
                      ) : null}
                    </div>
                  ) : null}
                </div>
              </Link>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
