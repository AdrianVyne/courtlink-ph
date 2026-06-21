import { MapPin } from "lucide-react";
import { notFound } from "next/navigation";
import { CourtBooking } from "../../../components/court-booking";
import { SiteHeader } from "../../../components/site-header";
import { type CourtSummary, type VenueSummary, apiFetch } from "../../../lib/api";
import { getSession } from "../../../lib/session";

export const dynamic = "force-dynamic";

async function loadVenue(slug: string): Promise<VenueSummary | null> {
  try {
    return await apiFetch<VenueSummary>(`/venues/by-slug/${encodeURIComponent(slug)}`);
  } catch {
    return null;
  }
}

async function loadCourts(venueId: string): Promise<CourtSummary[]> {
  try {
    return await apiFetch<CourtSummary[]>(`/courts/venues/${venueId}/list`);
  } catch {
    return [];
  }
}

export default async function VenueDetailPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const [venue, session] = await Promise.all([loadVenue(slug), getSession()]);
  if (!venue) notFound();
  const courts = await loadCourts(venue.id);

  return (
    <main>
      <SiteHeader session={session} />
      <section className="page-band">
        <div className="page-heading">
          <span className="kicker">Venue</span>
          <h1>{venue.name}</h1>
          <p className="page-sub venue-location">
            <MapPin size={16} aria-hidden="true" />
            {venue.streetAddress}, {venue.cityMunicipality}
          </p>
          {venue.description ? <p className="venue-desc">{venue.description}</p> : null}
        </div>

        {courts.length === 0 ? (
          <p className="empty-state">This venue has not published courts yet.</p>
        ) : (
          <div className="court-list">
            {courts.map((court) => (
              <CourtBooking key={court.id} court={court} isAuthenticated={Boolean(session)} />
            ))}
          </div>
        )}
      </section>
    </main>
  );
}
