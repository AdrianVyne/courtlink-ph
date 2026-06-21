import { BadgeCheck } from "lucide-react";
import { SiteHeader } from "../../components/site-header";
import { type CoachProfileSummary, apiFetch } from "../../lib/api";
import { getSession } from "../../lib/session";

export const dynamic = "force-dynamic";

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
    <main>
      <SiteHeader session={session} />
      <section className="page-band">
        <div className="page-heading">
          <span className="kicker">Find a coach</span>
          <h1>Coaches</h1>
          <p className="page-sub">Book a coach directly or post a request and compare offers.</p>
        </div>

        {coaches.length === 0 ? (
          <p className="empty-state">No coaches are listed yet.</p>
        ) : (
          <ul className="coach-grid">
            {coaches.map((coach) => (
              <li className="coach-card" key={coach.id}>
                <div className="coach-card-head">
                  <h2>Coach</h2>
                  {coach.verificationStatus === "VERIFIED" ? (
                    <span className="verified-tag">
                      <BadgeCheck size={15} aria-hidden="true" /> Verified
                    </span>
                  ) : (
                    <span className="unverified-tag">Unverified</span>
                  )}
                </div>
                {coach.bio ? <p className="coach-bio">{coach.bio}</p> : null}
                <p className="coach-rate">PHP {coach.hourlyRate.toFixed(2)} / hour</p>
              </li>
            ))}
          </ul>
        )}
      </section>
    </main>
  );
}
