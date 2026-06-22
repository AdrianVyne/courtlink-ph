import { redirect } from "next/navigation";
import { OperationsStatus } from "../../../components/operations-status";
import { SiteHeader } from "../../../components/site-header";
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
    <main>
      <SiteHeader session={session} />
      <section className="page-band">
        <div className="page-heading">
          <span className="kicker">Platform operations</span>
          <h1>System status</h1>
          <p className="page-sub">Live dependency, capacity, and background-job visibility.</p>
        </div>
        <OperationsStatus snapshot={snapshot} />
      </section>
    </main>
  );
}
