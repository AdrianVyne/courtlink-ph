import { BadgeCheck, Calendar, MapPin, Star } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { SiteFooter } from "../../../components/site-footer";
import { SiteHeader } from "../../../components/site-header";
import { Avatar, Button, Card } from "../../../components/ui";
import { type PublicCoachDetail, type VenueReviews, apiFetch } from "../../../lib/api";
import { peso } from "../../../lib/format";
import { coachJsonLd, jsonLdScript } from "../../../lib/jsonld";
import { getSession } from "../../../lib/session";
import { absoluteUrl } from "../../../lib/site";

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
  if (!coach) return { title: "Coach not found" };
  const description = coach.bio
    ? `${coach.bio.slice(0, 150)}${coach.bio.length > 150 ? "…" : ""}`
    : `Book ${coach.displayName} for pickleball coaching in the Philippines.`;
  return {
    title: `${coach.displayName} — pickleball coach`,
    description,
    alternates: { canonical: absoluteUrl(`/coaches/${coach.id}`) },
    openGraph: {
      title: `${coach.displayName} — pickleball coach`,
      description,
      type: "profile",
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
    <>
      <SiteHeader session={session} />
      <script
        // biome-ignore lint/security/noDangerouslySetInnerHtml: jsonLdScript escapes user-authored text
        dangerouslySetInnerHTML={{ __html: jsonLdScript(coachJsonLd(coach, reviews.rating)) }}
        type="application/ld+json"
      />
      <main className="mx-auto w-full max-w-4xl px-[5vw] py-8">
        <nav aria-label="Breadcrumb" className="mb-6 text-sm text-ink-500">
          <Link className="font-semibold text-court-800 hover:underline" href="/coaches">
            Coaches
          </Link>{" "}
          <span aria-hidden="true">/</span> <span>{coach.displayName}</span>
        </nav>

        <div className="flex flex-wrap items-start justify-between gap-5">
          <div className="flex items-center gap-4">
            <Avatar className="!size-16 text-xl" name={coach.displayName} />
            <div>
              <h1 className="m-0 flex flex-wrap items-center gap-3 font-display text-3xl font-bold tracking-tight text-ink-900">
                {coach.displayName}
                {coach.verificationStatus === "VERIFIED" ? (
                  <span className="flex items-center gap-1 text-sm font-semibold text-court-700">
                    <BadgeCheck aria-hidden="true" size={16} /> Verified
                  </span>
                ) : (
                  <span className="text-sm font-medium text-ink-500">Unverified</span>
                )}
              </h1>
              <p className="tnum m-0 mt-1 text-lg font-semibold text-court-800">
                {peso(coach.hourlyRate)}/hour
              </p>
              {reviews.rating.count > 0 ? (
                <p className="m-0 mt-1 flex items-center gap-1.5 text-sm text-ink-500">
                  <Star aria-hidden="true" className="text-pending-fg" size={15} />
                  {reviews.rating.average.toFixed(1)} ({reviews.rating.count}{" "}
                  {reviews.rating.count === 1 ? "review" : "reviews"})
                </p>
              ) : null}
            </div>
          </div>
          {session ? (
            <Button href={`/coach-requests?coachId=${coach.id}`}>Book this coach</Button>
          ) : (
            <Button href="/login">Log in to book</Button>
          )}
        </div>

        {coach.bio ? (
          <section className="mt-8">
            <h2 className="m-0 mb-2 font-display text-xl font-bold text-ink-900">About</h2>
            <p className="m-0 leading-relaxed text-ink-700">{coach.bio}</p>
          </section>
        ) : null}

        {coach.experience ? (
          <section className="mt-8">
            <h2 className="m-0 mb-2 font-display text-xl font-bold text-ink-900">Experience</h2>
            <p className="m-0 leading-relaxed text-ink-700">{coach.experience}</p>
          </section>
        ) : null}

        {coach.availability.length > 0 ? (
          <section className="mt-8">
            <h2 className="m-0 mb-3 font-display text-xl font-bold text-ink-900">Availability</h2>
            <ul className="m-0 flex list-none flex-col gap-2 p-0">
              {coach.availability.map((slot) => (
                <li key={slot.id}>
                  <Card className="flex flex-wrap items-center gap-x-4 gap-y-1 px-4 py-3 text-[0.95rem]">
                    <span className="flex items-center gap-1.5 font-medium text-ink-900">
                      <Calendar aria-hidden="true" className="text-court-700" size={15} />
                      {formatSlot(slot.startsAt)} &ndash; {formatSlot(slot.endsAt)}
                    </span>
                    <span className="flex items-center gap-1 text-ink-500">
                      <MapPin aria-hidden="true" size={14} /> {slot.location}
                    </span>
                  </Card>
                </li>
              ))}
            </ul>
          </section>
        ) : null}

        {reviews.items.length > 0 ? (
          <section className="mt-8">
            <h2 className="m-0 mb-3 font-display text-xl font-bold text-ink-900">Reviews</h2>
            <ul className="m-0 flex list-none flex-col gap-3 p-0">
              {reviews.items.map((review) => (
                <li key={review.id}>
                  <Card className="px-4 py-3">
                    <div className="flex items-center gap-3 text-sm">
                      <span
                        aria-label={`${review.rating} out of 5 stars`}
                        className="tracking-widest text-pending-fg"
                        role="img"
                      >
                        {"★".repeat(review.rating)}
                        <span className="text-sand-300">{"★".repeat(5 - review.rating)}</span>
                      </span>
                      <time className="text-ink-500" dateTime={review.createdAt}>
                        {formatDate(review.createdAt)}
                      </time>
                    </div>
                    {review.comment ? (
                      <p className="m-0 mt-1.5 text-[0.95rem] text-ink-700">{review.comment}</p>
                    ) : null}
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
