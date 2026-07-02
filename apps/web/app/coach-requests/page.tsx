import { redirect } from "next/navigation";
import { PlayerCoaching } from "../../components/player-coaching";
import { WorkspaceShell } from "../../components/workspace-shell";
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
    <WorkspaceShell
      kicker="Coaching"
      session={session}
      sub="Post a request, compare offers, and pay your coach."
      title="Find a coach"
    >
      <PlayerCoaching requests={requests} />
    </WorkspaceShell>
  );
}
