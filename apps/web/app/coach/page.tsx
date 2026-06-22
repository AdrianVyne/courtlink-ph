import { redirect } from "next/navigation";
import { CoachWorkspace } from "../../components/coach-workspace";
import { SiteHeader } from "../../components/site-header";
import {
  type CoachBookingListItem,
  type CoachMe,
  type OpenCoachJob,
  apiFetch,
} from "../../lib/api";
import { getSession } from "../../lib/session";

export const dynamic = "force-dynamic";

async function load<T>(path: string, cookie: string, fallback: T): Promise<T> {
  try {
    return await apiFetch<T>(path, { cookie });
  } catch {
    return fallback;
  }
}

export default async function CoachPage() {
  const session = await getSession();
  if (!session) redirect("/login");
  const { cookies } = await import("next/headers");
  const cookie = (await cookies()).toString();
  const [me, jobs, bookings] = await Promise.all([
    load<CoachMe>("/coaches/me", cookie, { profile: null, availability: [] }),
    load<OpenCoachJob[]>("/coaches/requests/open", cookie, []),
    load<CoachBookingListItem[]>("/coaches/me/bookings", cookie, []),
  ]);

  return (
    <main>
      <SiteHeader session={session} />
      <section className="page-band">
        <div className="page-heading">
          <span className="kicker">Coach workspace</span>
          <h1>Coaching</h1>
          <p className="page-sub">Manage your profile, availability, offers, and bookings.</p>
        </div>
        <CoachWorkspace me={me} jobs={jobs} bookings={bookings} />
      </section>
    </main>
  );
}
