import { redirect } from "next/navigation";
import { AdminVenueQueue } from "../../components/admin-venue-queue";
import { Button } from "../../components/ui";
import { WorkspaceShell } from "../../components/workspace-shell";
import { type VenueSummary, apiFetch } from "../../lib/api";
import { getSession } from "../../lib/session";

export const dynamic = "force-dynamic";

async function loadPending(cookie: string): Promise<VenueSummary[]> {
  try {
    return await apiFetch<VenueSummary[]>("/venues/admin/pending", { cookie });
  } catch {
    return [];
  }
}

export default async function AdminPage() {
  const session = await getSession();
  if (!session) redirect("/login");
  if (!session.roles.includes("SUPER_ADMIN")) redirect("/dashboard");
  const { cookies } = await import("next/headers");
  const cookie = (await cookies()).toString();
  const pending = await loadPending(cookie);

  return (
    <WorkspaceShell
      actions={
        <>
          <Button href="/admin/moderation" size="sm" variant="secondary">
            Moderation queue
          </Button>
          <Button href="/admin/operations" size="sm" variant="secondary">
            System status
          </Button>
        </>
      }
      kicker="Marketplace administration"
      session={session}
      sub="Review and approve venues before they go public."
      title="Pending venue approvals"
    >
      <AdminVenueQueue venues={pending} />
    </WorkspaceShell>
  );
}
