import { redirect } from "next/navigation";
import { PlayerCoaching } from "../../components/player-coaching";
import { SiteHeader } from "../../components/site-header";
import { type PlayerCoachRequest, apiFetch } from "../../lib/api";
import { getSession } from "../../lib/session";

export const dynamic = "force-dynamic";

async function load(cookie: string): Promise<PlayerCoachRequest[]> {
  try {
    return await apiFetch<PlayerCoachRequest[]>("/coaches/requests/mine", { cookie });
  } catch {
    return [];
  }
}

export default async function CoachRequestsPage() {
  const session = await getSession();
  if (!session) redirect("/login");
  const { cookies } = await import("next/headers");
  const cookie = (await cookies()).toString();
  const requests = await load(cookie);

  return (
    <main>
      <SiteHeader session={session} />
      <section className="page-band">
        <div className="page-heading">
          <span className="kicker">Coaching</span>
          <h1>Find a coach</h1>
          <p className="page-sub">Post a request, compare offers, and pay your coach.</p>
        </div>
        <PlayerCoaching requests={requests} />
      </section>
    </main>
  );
}
