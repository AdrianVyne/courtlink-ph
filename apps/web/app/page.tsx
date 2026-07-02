import { ArrowRight, ShieldCheck } from "lucide-react";
import { CoachesBand } from "../components/landing/coaches-band";
import { CtaBand } from "../components/landing/cta-band";
import { Faq } from "../components/landing/faq";
import { FeaturedVenues } from "../components/landing/featured-venues";
import { HeroSearch } from "../components/landing/hero-search";
import { HowItWorks } from "../components/landing/how-it-works";
import { ProofStrip } from "../components/landing/proof-strip";
import { TrustSection } from "../components/landing/trust-section";
import { SiteFooter } from "../components/site-footer";
import { SiteHeader } from "../components/site-header";
import { Button, CourtLines } from "../components/ui";
import {
  type CoachProfileSummary,
  type DiscoveryVenue,
  type PublicStats,
  apiFetch,
} from "../lib/api";
import { getSession } from "../lib/session";

export const dynamic = "force-dynamic";

async function loadStats(): Promise<PublicStats | null> {
  try {
    return await apiFetch<PublicStats>("/stats/public");
  } catch {
    return null;
  }
}

async function loadVenues(): Promise<DiscoveryVenue[]> {
  try {
    return await apiFetch<DiscoveryVenue[]>("/venues");
  } catch {
    return [];
  }
}

async function loadCoaches(): Promise<CoachProfileSummary[]> {
  try {
    return await apiFetch<CoachProfileSummary[]>("/coaches");
  } catch {
    return [];
  }
}

export default async function HomePage() {
  const [session, stats, venues, coaches] = await Promise.all([
    getSession(),
    loadStats(),
    loadVenues(),
    loadCoaches(),
  ]);

  return (
    <>
      <SiteHeader session={session} />
      <main>
        <section className="relative overflow-hidden px-[5vw] pt-24 pb-16 text-center">
          <CourtLines
            aria-hidden="true"
            className="pointer-events-none absolute left-1/2 top-8 w-[min(1100px,120vw)] -translate-x-1/2 text-court-400/15"
            variant="field"
          />
          <div className="relative">
            <p className="reveal m-0 mx-auto flex w-fit items-center gap-2 rounded-full bg-lime-400 px-3.5 py-2 text-[0.78rem] font-bold text-court-950">
              <ShieldCheck aria-hidden="true" size={15} />
              Pickleball courts &amp; coaches, PH-wide
            </p>
            <h1 className="reveal reveal-1 m-0 mx-auto mt-6 max-w-4xl font-display text-[clamp(2.8rem,7vw,5.5rem)] font-bold leading-[0.98] tracking-tight text-ink-900">
              Your next game is already out there.
            </h1>
            <p className="reveal reveal-2 m-0 mx-auto mt-6 max-w-xl text-lg leading-relaxed text-ink-500">
              Find courts and coaches across the Philippines, hold your slot, and pay the venue
              directly — no markups, no runaround.
            </p>
            <div className="reveal reveal-3 mt-8 flex flex-wrap justify-center gap-3">
              <Button href="/courts">
                Find a court <ArrowRight aria-hidden="true" size={17} />
              </Button>
              <Button href="/coaches" variant="secondary">
                Find a coach
              </Button>
            </div>
            <div className="reveal reveal-4">
              <HeroSearch />
            </div>
          </div>
        </section>

        <ProofStrip stats={stats} />
        <HowItWorks />
        <FeaturedVenues venues={venues} />
        <CoachesBand coaches={coaches} />
        <TrustSection />
        <Faq />
        <CtaBand />
      </main>
      <SiteFooter />
    </>
  );
}
