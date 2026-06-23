import { BadgeCheck, Calendar, MapPin, Star } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { SiteHeader } from "../../../components/site-header";
import { type PublicCoachDetail, type VenueReviews, apiFetch } from "../../../lib/api";
import { getSession } from "../../../lib/session";

export const dynamic = "force-dynamic";

async function loadCoach(id: string): Promise<PublicCoachDetail | null> {
  try {
    return await apiFetch<PublicCoachDetail>(`/coaches/${encodeURIComponent(id)}`);
  } catch {
    return null;
  }
}

async function loadReviews(coachId: string): Promise<VenueReviews> {
  try {
    return await apiFetch<VenueReviews>(`/reviews/coaches/${coachId}`);
  } catch {
    return { rating: { average: 0, count: 0 }, items: [] };
  }
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}): Promise<Metadata> {
  const { id } = await params;
  const coach = await loadCoach(id);
  if (!coach) return { title: "Coach not found | CourtLink PH" };
  const description = coach.bio
    ? `${coach.bio.slice(0, 150)}${coach.bio.length > 150 ? "..." : ""}`
    : `Book ${coach.displayName} for pickleball coaching in the Philippines.`;
  return {
    title: `${coach.displayName} | Pickleball Coach | CourtLink PH`,
    description,
    openGraph: {
      title: `${coach.displayName} ? Pickleball Coach`,
      description,
      type: "profile",
      siteName: "CourtLink PH",
    },
  };
}

function formatSlot(iso: string): string {
  return new Date(iso).toLocaleDateString("en-PH", {
    weekday: "short",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
    timeZone: "Asia/Manila",
  });
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString("en-PH", { dateStyle: "medium" });
}

export default async function CoachProfilePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const [coach, session] = await Promise.all([loadCoach(id), getSession()]);
  if (!coach) notFound();
  const reviews = await loadReviews(coach.id);

  return (
    <main>
      <SiteHeader session={session} />
      <section className="page-band">
        <nav className="breadcrumb" aria-label="Breadcrumb">
          <Link href="/coaches">Coaches</Link> <span aria-hidden="true">/</span>{" "}
          <span>{coach.displayName}</span>
        </nav>

        <div className="coach-profile-header">
          <h1>{coach.displayName}</h1>
          {coach.verificationStatus === "VERIFIED" ? (
            <span className="verified-tag">
              <BadgeCheck size={16} aria-hidden="true" /> Verified
            </span>
          ) : (
            <span className="unverified-tag">Unverified</span>
          )}
        </div>

        <p className="coach-rate-large">PHP {coach.hourlyRate.toFixed(2)} / hour</p>

        {reviews.rating.count > 0 ? (
          <div className="coach-rating-summary">
            <Star size={16} aria-hidden="true" />
            <span>
              {reviews.rating.average.toFixed(1)} ({reviews.rating.count}{" "}
              {reviews.rating.count === 1 ? "review" : "reviews"})
            </span>
          </div>
        ) : null}

        {coach.bio ? (
          <div className="coach-section">
            <h2>About</h2>
            <p>{coach.bio}</p>
          </div>
        ) : null}

        {coach.experience ? (
          <div className="coach-section">
            <h2>Experience</h2>
            <p>{coach.experience}</p>
          </div>
        ) : null}

        {coach.availability.length > 0 ? (
          <div className="coach-section">
            <h2>Availability</h2>
            <ul className="availability-list">
              {coach.availability.map((slot) => (
                <li key={slot.id} className="availability-slot">
                  <Calendar size={14} aria-hidden="true" />
                  <span>
                    {formatSlot(slot.startsAt)} &ndash; {formatSlot(slot.endsAt)}
                  </span>
                  <span className="slot-location">
                    <MapPin size={14} aria-hidden="true" /> {slot.location}
                  </span>
                </li>
              ))}
            </ul>
          </div>
        ) : null}

        {session ? (
          <div className="coach-actions">
            <Link className="button-primary" href={`/coach-requests?coachId=${coach.id}`}>
              Book this coach
            </Link>
          </div>
        ) : (
          <div className="coach-actions">
            <Link className="button-primary" href="/login">
              Log in to book
            </Link>
          </div>
        )}

        {reviews.items.length > 0 ? (
          <div className="coach-section">
            <h2>Reviews</h2>
            <ul className="review-list">
              {reviews.items.map((review) => (
                <li key={review.id} className="review-item">
                  <div className="review-meta">
                    <span
                      className="review-stars"
                      role="img"
                      aria-label={`${review.rating} out of 5 stars`}
                    >
                      {"?".repeat(review.rating)}
                      {"?".repeat(5 - review.rating)}
                    </span>
                    <time dateTime={review.createdAt}>{formatDate(review.createdAt)}</time>
                  </div>
                  {review.comment ? <p>{review.comment}</p> : null}
                </li>
              ))}
            </ul>
          </div>
        ) : null}
      </section>
    </main>
  );
}
