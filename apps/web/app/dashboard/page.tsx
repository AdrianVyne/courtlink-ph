import { redirect } from "next/navigation";
import { SiteHeader } from "../../components/site-header";
import { getSession } from "../../lib/session";

export const dynamic = "force-dynamic";

export default async function DashboardPage() {
  const session = await getSession();
  if (!session) redirect("/login");

  return (
    <main>
      <SiteHeader session={session} />
      <section className="page-band">
        <div className="page-heading">
          <span className="kicker">Your account</span>
          <h1>Welcome, {session.displayName}</h1>
          <p className="page-sub">{session.email}</p>
        </div>
        <div className="role-row">
          {session.roles.map((role) => (
            <span className="role-chip" key={role}>
              {role}
            </span>
          ))}
        </div>
      </section>
    </main>
  );
}
