import { redirect } from "next/navigation";
import { ModerationQueue } from "../../../components/moderation-queue";
import { WorkspaceShell } from "../../../components/workspace-shell";
import { type ModerationCase, apiFetch } from "../../../lib/api";
import { getSession } from "../../../lib/session";

export const dynamic = "force-dynamic";

async function load(cookie: string): Promise<ModerationCase[]> {
  try {
    return await apiFetch<ModerationCase[]>("/moderation/cases", { cookie });
  } catch {
    return [];
  }
}

export default async function ModerationPage() {
  const session = await getSession();
  if (!session) redirect("/login");
  if (!session.roles.includes("SUPER_ADMIN")) redirect("/dashboard");
  const { cookies } = await import("next/headers");
  const cookie = (await cookies()).toString();
  const cases = await load(cookie);

  return (
    <WorkspaceShell
      kicker="Trust and safety"
      session={session}
      sub="Review reports, suspend abusive listings, and resolve cases."
      title="Moderation queue"
    >
      <ModerationQueue cases={cases} />
    </WorkspaceShell>
  );
}
