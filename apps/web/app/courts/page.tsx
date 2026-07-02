import type { Metadata } from "next";
import { FilterBar } from "../../components/discovery/filter-bar";
import { VenueCard } from "../../components/discovery/venue-card";
import { SiteFooter } from "../../components/site-footer";
import { SiteHeader } from "../../components/site-header";
import { Button, EmptyState } from "../../components/ui";
import { type AmenityCatalogEntry, type DiscoveryVenue, apiFetch } from "../../lib/api";
import { getSession } from "../../lib/session";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Find a pickleball court",
  description:
    "Search pickleball venues across the Philippines by city, date, price, and amenities.",
};

interface DiscoveryParams {
  q?: string | undefined;
  city?: string | undefined;
  amenities?: string | undefined;
  maxPrice?: string | undefined;
  date?: string | undefined;
  durationMin?: string | undefined;
}

async function loadCatalog(): Promise<AmenityCatalogEntry[]> {
  try {
    return await apiFetch<AmenityCatalogEntry[]>("/amenities");
  } catch {
    return [];
  }
}

async function loadVenues(params: DiscoveryParams): Promise<DiscoveryVenue[]> {
  const query: Record<string, string> = {};
  if (params.q) query.query = params.q;
  if (params.city) query.cityMunicipality = params.city;
  if (params.amenities) query.amenities = params.amenities;
  if (params.maxPrice) query.maxPrice = params.maxPrice;
  if (params.date) {
    query.availableDate = params.date;
    query.durationMin = params.durationMin ?? "60";
  }
  try {
    return await apiFetch<DiscoveryVenue[]>("/venues", { query });
  } catch {
    return [];
  }
}

function normalizeAmenities(value: string | string[] | undefined): string | undefined {
  if (Array.isArray(value)) return value.filter(Boolean).join(",") || undefined;
  return value || undefined;
}

export default async function CourtsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const raw = await searchParams;
  const params: DiscoveryParams = {
    q: typeof raw.q === "string" ? raw.q : undefined,
    city: typeof raw.city === "string" ? raw.city : undefined,
    date: typeof raw.date === "string" ? raw.date : undefined,
    durationMin: typeof raw.durationMin === "string" ? raw.durationMin : undefined,
    maxPrice: typeof raw.maxPrice === "string" ? raw.maxPrice : undefined,
    amenities: normalizeAmenities(raw.amenities),
  };
  const [session, catalog] = await Promise.all([getSession(), loadCatalog()]);
  const venues = await loadVenues(params);
  const venueAmenities = catalog.filter((entry) => entry.scope !== "COURT");
  const hasFilters = Object.values(params).some(Boolean);

  return (
    <>
      <SiteHeader session={session} />
      <main className="mx-auto w-full max-w-6xl px-[5vw] py-10">
        <div className="mb-6">
          <span className="text-xs font-bold uppercase tracking-widest text-court-700">
            Find a court
          </span>
          <h1 className="m-0 mt-1 font-display text-4xl font-bold tracking-tight text-ink-900">
            Pickleball venues
          </h1>
          <p className="m-0 mt-2 text-ink-500">
            Search nationwide by location, availability, price, and amenities.
          </p>
        </div>

        <FilterBar
          amenityCatalog={venueAmenities.map(({ key, name }) => ({ key, name }))}
          params={params}
          resultCount={venues.length}
        />

        {venues.length === 0 ? (
          <EmptyState
            action={
              hasFilters ? (
                <Button href="/courts" variant="secondary">
                  Clear all filters
                </Button>
              ) : undefined
            }
            body={
              hasFilters
                ? "Try widening your search — fewer filters, a nearby city, or another date."
                : "Venues are joining CourtLink every week. Check back soon."
            }
            title="No venues match these filters"
          />
        ) : (
          <ul className="m-0 grid list-none gap-4 p-0 sm:grid-cols-2 lg:grid-cols-3">
            {venues.map((venue) => (
              <li key={venue.id}>
                <VenueCard catalog={catalog} venue={venue} />
              </li>
            ))}
          </ul>
        )}
      </main>
      <SiteFooter />
    </>
  );
}
