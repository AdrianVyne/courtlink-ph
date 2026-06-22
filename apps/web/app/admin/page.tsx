import Link from "next/link";
import { redirect } from "next/navigation";
import { AdminVenueQueue } from "../../components/admin-venue-queue";
import { SiteHeader } from "../../components/site-header";
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
    <main>
      <SiteHeader session={session} />
      <section className="page-band">
        <div className="page-heading">
          <span className="kicker">Marketplace administration</span>
          <h1>Pending venue approvals</h1>
          <p className="page-sub">Review and approve venues before they go public.</p>
        </div>
        <div className="dashboard-links">
          <Link className="button button-secondary button-small" href="/admin/moderation">
            Moderation queue
          </Link>
          <Link className="button button-secondary button-small" href="/admin/operations">
            System status
          </Link>
        </div>
        <AdminVenueQueue venues={pending} />
      </section>
    </main>
  );
}
