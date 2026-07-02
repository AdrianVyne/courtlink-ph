import { redirect } from "next/navigation";
import { OperationsStatus } from "../../../components/operations-status";
import { WorkspaceShell } from "../../../components/workspace-shell";
import { type OperationsStatusSnapshot, apiFetch } from "../../../lib/api";
import { getSession } from "../../../lib/session";

export const dynamic = "force-dynamic";

export default async function OperationsPage() {
  const session = await getSession();
  if (!session) redirect("/login");
  if (!session.roles.includes("SUPER_ADMIN")) redirect("/dashboard");
  const { cookies } = await import("next/headers");
  const cookie = (await cookies()).toString();
  const snapshot = await apiFetch<OperationsStatusSnapshot>("/operations/status", { cookie });

  return (
    <WorkspaceShell
      kicker="Platform operations"
      session={session}
      sub="Live dependency, capacity, and background-job visibility."
      title="System status"
    >
      <OperationsStatus snapshot={snapshot} />
    </WorkspaceShell>
  );
}
