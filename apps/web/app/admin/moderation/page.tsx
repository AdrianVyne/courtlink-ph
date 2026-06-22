import { redirect } from "next/navigation";
import { ModerationQueue } from "../../../components/moderation-queue";
import { SiteHeader } from "../../../components/site-header";
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
    <main>
      <SiteHeader session={session} />
      <section className="page-band">
        <div className="page-heading">
          <span className="kicker">Trust and safety</span>
          <h1>Moderation queue</h1>
          <p className="page-sub">Review reports, suspend abusive listings, and resolve cases.</p>
        </div>
        <ModerationQueue cases={cases} />
      </section>
    </main>
  );
}
