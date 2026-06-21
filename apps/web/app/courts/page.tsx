import { MapPin } from "lucide-react";
import Link from "next/link";
import { SiteHeader } from "../../components/site-header";
import { type VenueSummary, apiFetch } from "../../lib/api";
import { getSession } from "../../lib/session";

export const dynamic = "force-dynamic";

async function loadVenues(query?: string): Promise<VenueSummary[]> {
  try {
    return await apiFetch<VenueSummary[]>("/venues", {
      ...(query ? { query: { query } } : {}),
    });
  } catch {
    return [];
  }
}

export default async function CourtsPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>;
}) {
  const [{ q }, session] = await Promise.all([searchParams, getSession()]);
  const venues = await loadVenues(q);

  return (
    <main>
      <SiteHeader session={session} />
      <section className="page-band">
        <div className="page-heading">
          <span className="kicker">Find a court</span>
          <h1>Pickleball venues</h1>
          <p className="page-sub">Browse approved venues and book an available court.</p>
        </div>

        <form className="search-row" action="/courts" method="get">
          <input
            name="q"
            type="search"
            defaultValue={q ?? ""}
            placeholder="Search by venue name"
            aria-label="Search venues"
          />
          <button className="button button-small" type="submit">
            Search
          </button>
        </form>

        {venues.length === 0 ? (
          <p className="empty-state">No venues match yet. Check back soon.</p>
        ) : (
          <ul className="venue-grid">
            {venues.map((venue) => (
              <li key={venue.id}>
                <Link className="venue-card" href={`/courts/${venue.slug}`}>
                  <h2>{venue.name}</h2>
                  <p className="venue-location">
                    <MapPin size={15} aria-hidden="true" />
                    {venue.cityMunicipality}
                    {venue.provinceCode ? `, ${venue.provinceCode}` : ""}
                  </p>
                  {venue.description ? <p className="venue-desc">{venue.description}</p> : null}
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>
    </main>
  );
}
