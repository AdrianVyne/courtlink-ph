import { MapPin } from "lucide-react";
import Link from "next/link";
import { SiteHeader } from "../../components/site-header";
import { type AmenityCatalogEntry, type DiscoveryVenue, apiFetch } from "../../lib/api";
import { getSession } from "../../lib/session";

export const dynamic = "force-dynamic";

interface DiscoveryParams {
  q?: string;
  city?: string;
  amenities?: string;
  maxPrice?: string;
  date?: string;
  durationMin?: string;
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

function peso(amount: number): string {
  return `\u20b1${amount.toLocaleString("en-PH", { minimumFractionDigits: 0, maximumFractionDigits: 2 })}`;
}

export default async function CourtsPage({
  searchParams,
}: {
  searchParams: Promise<DiscoveryParams>;
}) {
  const [params, session] = await Promise.all([searchParams, getSession()]);
  const [venues, catalog] = await Promise.all([loadVenues(params), loadCatalog()]);
  const venueAmenities = catalog.filter((entry) => entry.scope !== "COURT");
  const selectedAmenities = new Set((params.amenities ?? "").split(",").filter(Boolean));

  return (
    <main>
      <SiteHeader session={session} />
      <section className="page-band">
        <div className="page-heading">
          <span className="kicker">Find a court</span>
          <h1>Pickleball venues</h1>
          <p className="page-sub">
            Search nationwide by location, availability, price, and amenities.
          </p>
        </div>

        <form className="discovery-filters" action="/courts" method="get">
          <div className="filter-row">
            <label className="filter-field">
              <span>Search</span>
              <input
                name="q"
                type="search"
                defaultValue={params.q ?? ""}
                placeholder="Venue name"
              />
            </label>
            <label className="filter-field">
              <span>City or municipality</span>
              <input
                name="city"
                type="text"
                defaultValue={params.city ?? ""}
                placeholder="e.g. Cebu City"
              />
            </label>
            <label className="filter-field">
              <span>Date</span>
              <input name="date" type="date" defaultValue={params.date ?? ""} />
            </label>
            <label className="filter-field">
              <span>Duration</span>
              <select name="durationMin" defaultValue={params.durationMin ?? "60"}>
                <option value="60">1 hour</option>
                <option value="90">1.5 hours</option>
                <option value="120">2 hours</option>
                <option value="180">3 hours</option>
              </select>
            </label>
            <label className="filter-field">
              <span>Max price / hour</span>
              <input
                name="maxPrice"
                type="number"
                min="0"
                step="50"
                defaultValue={params.maxPrice ?? ""}
                placeholder="Any"
              />
            </label>
          </div>

          {venueAmenities.length > 0 ? (
            <fieldset className="amenity-filter">
              <legend>Amenities</legend>
              <div className="amenity-options">
                {venueAmenities.map((entry) => (
                  <label key={entry.key} className="amenity-chip">
                    <input
                      type="checkbox"
                      name="amenities"
                      value={entry.key}
                      defaultChecked={selectedAmenities.has(entry.key)}
                    />
                    <span>{entry.name}</span>
                  </label>
                ))}
              </div>
            </fieldset>
          ) : null}

          <div className="filter-actions">
            <button className="button button-small" type="submit">
              Apply filters
            </button>
            <Link className="button button-ghost button-small" href="/courts">
              Reset
            </Link>
          </div>
        </form>

        {venues.length === 0 ? (
          <p className="empty-state">
            No venues match these filters yet. Try widening your search.
          </p>
        ) : (
          <ul className="venue-grid">
            {venues.map((venue) => (
              <li key={venue.id}>
                <Link className="venue-card" href={`/courts/${venue.slug}`}>
                  <div className="venue-card-head">
                    <h2>{venue.name}</h2>
                    {venue.fromPrice !== null ? (
                      <span className="venue-price">from {peso(venue.fromPrice)}/hr</span>
                    ) : null}
                  </div>
                  <p className="venue-location">
                    <MapPin size={15} aria-hidden="true" />
                    {venue.cityMunicipality}
                    {venue.provinceCode ? `, ${venue.provinceCode}` : ""}
                  </p>
                  {venue.description ? <p className="venue-desc">{venue.description}</p> : null}
                  {venue.amenities.length > 0 ? (
                    <ul className="venue-amenities">
                      {venue.amenities.slice(0, 5).map((key) => (
                        <li key={key}>{formatAmenity(key, catalog)}</li>
                      ))}
                    </ul>
                  ) : null}
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>
    </main>
  );
}

function formatAmenity(key: string, catalog: AmenityCatalogEntry[]): string {
  return catalog.find((entry) => entry.key === key)?.name ?? key;
}
