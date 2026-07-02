import { MapPin } from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import type { AmenityCatalogEntry, DiscoveryVenue } from "../../lib/api";
import { peso } from "../../lib/format";
import { Badge } from "../ui";
import { CoverPlaceholder } from "./cover-placeholder";

export function VenueCard({
  venue,
  catalog,
}: {
  venue: DiscoveryVenue;
  catalog: AmenityCatalogEntry[];
}) {
  return (
    <Link
      className="group flex h-full flex-col overflow-hidden rounded-(--radius-card) border border-sand-200 bg-white transition-[border-color,box-shadow,transform] duration-200 ease-out hover:border-court-400 hover:shadow-float motion-safe:hover:-translate-y-0.5"
      href={`/courts/${venue.slug}`}
    >
      {venue.coverPhotoUrl ? (
        <div className="relative h-28 overflow-hidden bg-sand-100">
          <Image
            alt={venue.coverPhotoAltText ?? `${venue.name} court photo`}
            className="object-cover transition-transform duration-200 motion-safe:group-hover:scale-[1.02]"
            fill
            sizes="(min-width: 1024px) 33vw, (min-width: 640px) 50vw, 100vw"
            src={venue.coverPhotoUrl}
            unoptimized
          />
        </div>
      ) : (
        <CoverPlaceholder className="h-28" seed={venue.slug} />
      )}
      <div className="flex flex-1 flex-col p-5">
        <div className="flex items-baseline justify-between gap-3">
          <h2 className="m-0 text-lg font-semibold text-ink-900">{venue.name}</h2>
          {venue.fromPrice !== null ? (
            <span className="tnum whitespace-nowrap text-sm font-semibold text-court-800">
              from {peso(venue.fromPrice)}/hr
            </span>
          ) : null}
        </div>
        <p className="m-0 mt-1 flex items-center gap-1 text-sm text-ink-500">
          <MapPin aria-hidden="true" size={14} />
          {venue.cityMunicipality}
          {venue.provinceCode ? `, ${venue.provinceCode}` : ""}
        </p>
        {venue.description ? (
          <p className="m-0 mt-2 line-clamp-2 text-[0.9rem] text-ink-700">{venue.description}</p>
        ) : null}
        {venue.amenities.length > 0 ? (
          <div className="mt-auto flex flex-wrap gap-1.5 pt-3">
            {venue.amenities.slice(0, 4).map((key) => (
              <Badge key={key}>{catalog.find((entry) => entry.key === key)?.name ?? key}</Badge>
            ))}
            {venue.amenities.length > 4 ? <Badge>+{venue.amenities.length - 4} more</Badge> : null}
          </div>
        ) : null}
      </div>
    </Link>
  );
}
