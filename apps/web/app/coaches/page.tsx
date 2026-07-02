import type { Metadata } from "next";
import { CoachCard } from "../../components/discovery/coach-card";
import { SiteFooter } from "../../components/site-footer";
import { SiteHeader } from "../../components/site-header";
import { Button, EmptyState } from "../../components/ui";
import { type CoachProfileSummary, apiFetch } from "../../lib/api";
import { getSession } from "../../lib/session";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Find a pickleball coach",
  description:
    "Book verified pickleball coaches across the Philippines, or post an open request and compare offers.",
};

async function loadCoaches(): Promise<CoachProfileSummary[]> {
  try {
    return await apiFetch<CoachProfileSummary[]>("/coaches");
  } catch {
    return [];
  }
}

export default async function CoachesPage() {
  const [coaches, session] = await Promise.all([loadCoaches(), getSession()]);

  return (
    <>
      <SiteHeader session={session} />
      <main className="mx-auto w-full max-w-6xl px-[5vw] py-10">
        <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
          <div>
            <span className="text-xs font-bold uppercase tracking-widest text-court-700">
              Find a coach
            </span>
            <h1 className="m-0 mt-1 font-display text-4xl font-bold tracking-tight text-ink-900">
              Coaches
            </h1>
            <p className="m-0 mt-2 text-ink-500">
              Book a coach directly or post a request and compare offers.
            </p>
          </div>
          <Button href="/coach-requests" variant="secondary">
            Post an open request
          </Button>
        </div>

        {coaches.length === 0 ? (
          <EmptyState
            action={<Button href="/coach-requests">Post an open request</Button>}
            body="No coaches are listed yet — post what you need and let coaches come to you."
            title="No coaches listed yet"
          />
        ) : (
          <ul className="m-0 grid list-none gap-4 p-0 sm:grid-cols-2 lg:grid-cols-3">
            {coaches.map((coach) => (
              <li key={coach.id}>
                <CoachCard coach={coach} />
              </li>
            ))}
          </ul>
        )}
      </main>
      <SiteFooter />
    </>
  );
}
