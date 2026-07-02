import { MapPin, Star } from "lucide-react";
import type { Metadata } from "next";
import Image from "next/image";
import { notFound } from "next/navigation";
import { CourtBooking } from "../../../components/court-booking";
import { CoverPlaceholder } from "../../../components/discovery/cover-placeholder";
import { FavoriteToggle } from "../../../components/favorite-toggle";
import { PromotionBanner } from "../../../components/promotion-banner";
import { RatingBadge } from "../../../components/rating-badge";
import { ReportButton } from "../../../components/report-button";
import { SiteFooter } from "../../../components/site-footer";
import { SiteHeader } from "../../../components/site-header";
import { Card, EmptyState } from "../../../components/ui";
import {
  type CourtSummary,
  type Promotion,
  type VenueReviews,
  type VenueSummary,
  apiFetch,
} from "../../../lib/api";
import { jsonLdScript, venueJsonLd } from "../../../lib/jsonld";
import { getSession } from "../../../lib/session";
import { absoluteUrl } from "../../../lib/site";

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

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const venue = await loadVenue(slug);
  if (!venue) return { title: "Venue not found" };
  const description = venue.description
    ? `${venue.description.slice(0, 150)}${venue.description.length > 150 ? "…" : ""}`
    : `Book pickleball courts at ${venue.name} in ${venue.cityMunicipality} — pay the venue directly, no markup.`;
  return {
    title: `${venue.name} — pickleball courts in ${venue.cityMunicipality}`,
    description,
    alternates: { canonical: absoluteUrl(`/courts/${venue.slug}`) },
    openGraph: {
      title: venue.name,
      description,
      type: "website",
    },
  };
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
  const photos = venue.photos ?? [];
  const heroPhoto = photos[0];
  const secondaryPhotos = photos.slice(1, 3);
  const galleryClassName = secondaryPhotos.length > 0 ? "grid gap-3 md:grid-cols-[2fr_1fr]" : "";

  return (
    <>
      <SiteHeader session={session} />
      <script
        // biome-ignore lint/security/noDangerouslySetInnerHtml: jsonLdScript escapes user-authored text
        dangerouslySetInnerHTML={{ __html: jsonLdScript(venueJsonLd(venue, reviews.rating)) }}
        type="application/ld+json"
      />
      <main className="mx-auto w-full max-w-6xl px-[5vw] py-8">
        {heroPhoto ? (
          <section aria-label={`${venue.name} photos`} className={galleryClassName}>
            <div className="relative h-44 overflow-hidden rounded-(--radius-card) bg-sand-100 sm:h-56">
              <Image
                alt={heroPhoto.altText}
                className="object-cover"
                fill
                priority
                sizes={secondaryPhotos.length > 0 ? "(min-width: 768px) 66vw, 100vw" : "100vw"}
                src={heroPhoto.url}
                unoptimized
              />
            </div>
            {secondaryPhotos.length > 0 ? (
              <div className="grid grid-cols-2 gap-3 md:grid-cols-1">
                {secondaryPhotos.map((photo) => (
                  <div
                    className="relative min-h-24 overflow-hidden rounded-(--radius-card) bg-sand-100"
                    key={photo.id}
                  >
                    <Image
                      alt={photo.altText}
                      className="object-cover"
                      fill
                      sizes="(min-width: 768px) 25vw, 50vw"
                      src={photo.url}
                      unoptimized
                    />
                  </div>
                ))}
              </div>
            ) : null}
          </section>
        ) : (
          <CoverPlaceholder className="h-44 rounded-(--radius-card) sm:h-56" seed={venue.slug} />
        )}

        <div className="mt-6 flex flex-wrap items-start justify-between gap-4">
          <div className="max-w-2xl">
            <span className="text-xs font-bold uppercase tracking-widest text-court-700">
              Venue
            </span>
            <h1 className="m-0 mt-1 font-display text-4xl font-bold tracking-tight text-ink-900">
              {venue.name}
            </h1>
            <p className="m-0 mt-2 flex items-center gap-1.5 text-ink-500">
              <MapPin aria-hidden="true" size={16} />
              {venue.streetAddress}, {venue.cityMunicipality}
            </p>
            {venue.description ? (
              <p className="m-0 mt-3 leading-relaxed text-ink-700">{venue.description}</p>
            ) : null}
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <RatingBadge average={reviews.rating.average} count={reviews.rating.count} />
            {session ? <FavoriteToggle venueId={venue.id} initial={isFavorite} /> : null}
            {session ? <ReportButton subjectType="VENUE" subjectId={venue.id} /> : null}
          </div>
        </div>

        <PromotionBanner promotions={promotions} />

        <section aria-labelledby="courts-heading" className="mt-8">
          <h2
            className="m-0 mb-4 font-display text-2xl font-bold tracking-tight text-ink-900"
            id="courts-heading"
          >
            Courts and availability
          </h2>
          {courts.length === 0 ? (
            <EmptyState
              body="The venue is still setting up its schedule — check back soon."
              title="No courts published yet"
            />
          ) : (
            <div className="grid gap-4 lg:grid-cols-2">
              {courts.map((court) => (
                <CourtBooking key={court.id} court={court} isAuthenticated={Boolean(session)} />
              ))}
            </div>
          )}
        </section>

        {reviews.items.length > 0 ? (
          <section aria-labelledby="reviews-heading" className="mt-10">
            <h2
              className="m-0 mb-4 flex items-center gap-2 font-display text-2xl font-bold tracking-tight text-ink-900"
              id="reviews-heading"
            >
              <Star aria-hidden="true" className="text-pending-fg" size={20} />
              Player reviews
            </h2>
            <ul className="m-0 flex list-none flex-col gap-3 p-0">
              {reviews.items.map((review) => (
                <li key={review.id}>
                  <Card className="flex flex-wrap items-baseline gap-3 px-4 py-3">
                    <span
                      aria-label={`${review.rating} out of 5 stars`}
                      className="tracking-widest text-pending-fg"
                      role="img"
                    >
                      {"★".repeat(review.rating)}
                    </span>
                    {review.comment ? (
                      <span className="text-[0.95rem] text-ink-700">{review.comment}</span>
                    ) : null}
                    <span className="ml-auto text-sm text-ink-500">
                      {formatWhen(review.createdAt)}
                    </span>
                  </Card>
                </li>
              ))}
            </ul>
          </section>
        ) : null}
      </main>
      <SiteFooter />
    </>
  );
}
