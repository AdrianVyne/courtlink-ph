import { MapPin } from "lucide-react";
import { notFound } from "next/navigation";
import { CourtBooking } from "../../../components/court-booking";
import { FavoriteToggle } from "../../../components/favorite-toggle";
import { PromotionBanner } from "../../../components/promotion-banner";
import { RatingBadge } from "../../../components/rating-badge";
import { ReportButton } from "../../../components/report-button";
import { SiteHeader } from "../../../components/site-header";
import {
  type CourtSummary,
  type Promotion,
  type VenueReviews,
  type VenueSummary,
  apiFetch,
} from "../../../lib/api";
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

async function loadPromotions(venueId: string): Promise<Promotion[]> {
  try {
    return await apiFetch<Promotion[]>(`/promotions/venues/${venueId}/active`);
  } catch {
    return [];
  }
}

async function loadReviews(venueId: string): Promise<VenueReviews> {
  try {
    return await apiFetch<VenueReviews>(`/reviews/venues/${venueId}`);
  } catch {
    return { rating: { average: 0, count: 0 }, items: [] };
  }
}

async function loadFavorite(venueId: string, cookie: string): Promise<boolean> {
  try {
    const result = await apiFetch<{ favorite: boolean }>(`/favorites/venues/${venueId}`, {
      cookie,
    });
    return result.favorite;
  } catch {
    return false;
  }
}

function formatWhen(iso: string): string {
  return new Date(iso).toLocaleDateString("en-PH", { dateStyle: "medium" });
}

export default async function VenueDetailPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const [venue, session] = await Promise.all([loadVenue(slug), getSession()]);
  if (!venue) notFound();
  const [courts, reviews, promotions] = await Promise.all([
    loadCourts(venue.id),
    loadReviews(venue.id),
    loadPromotions(venue.id),
  ]);

  let isFavorite = false;
  if (session) {
    const { cookies } = await import("next/headers");
    isFavorite = await loadFavorite(venue.id, (await cookies()).toString());
  }

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
          <div className="venue-toolbar">
            <RatingBadge average={reviews.rating.average} count={reviews.rating.count} />
            {session ? <FavoriteToggle venueId={venue.id} initial={isFavorite} /> : null}
            {session ? <ReportButton subjectType="VENUE" subjectId={venue.id} /> : null}
          </div>
          {venue.description ? <p className="venue-desc">{venue.description}</p> : null}
          <PromotionBanner promotions={promotions} />
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

        {reviews.items.length > 0 ? (
          <div className="review-section">
            <h2 className="section-title">Player reviews</h2>
            <ul className="review-list">
              {reviews.items.map((review) => (
                <li className="review-row" key={review.id}>
                  <span className="review-rating">{"\u2605".repeat(review.rating)}</span>
                  {review.comment ? <span className="review-comment">{review.comment}</span> : null}
                  <span className="review-when">{formatWhen(review.createdAt)}</span>
                </li>
              ))}
            </ul>
          </div>
        ) : null}
      </section>
    </main>
  );
}
