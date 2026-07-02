import { redirect } from "next/navigation";
import { CoachWorkspace } from "../../components/coach-workspace";
import { WorkspaceShell } from "../../components/workspace-shell";
import {
  type CoachBookingListItem,
  type CoachMe,
  type DirectedRequest,
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
  const [me, jobs, bookings, directed] = await Promise.all([
    load<CoachMe>("/coaches/me", cookie, { profile: null, availability: [] }),
    load<OpenCoachJob[]>("/coaches/requests/open", cookie, []),
    load<CoachBookingListItem[]>("/coaches/me/bookings", cookie, []),
    load<DirectedRequest[]>("/coaches/requests/directed", cookie, []),
  ]);

  return (
    <WorkspaceShell
      kicker="Coach workspace"
      session={session}
      sub="Manage your profile, availability, offers, and bookings."
      title="Coaching"
    >
      <CoachWorkspace me={me} jobs={jobs} bookings={bookings} directed={directed} />
    </WorkspaceShell>
  );
}
