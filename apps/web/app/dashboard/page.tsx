import Link from "next/link";
import { redirect } from "next/navigation";
import { BookingList } from "../../components/booking-list";
import { SiteHeader } from "../../components/site-header";
import { type BookingListItem, apiFetch } from "../../lib/api";
import { getSession } from "../../lib/session";

export const dynamic = "force-dynamic";

async function loadMyBookings(cookie: string): Promise<BookingListItem[]> {
  try {
    return await apiFetch<BookingListItem[]>("/courts/bookings/mine", { cookie });
  } catch {
    return [];
  }
}

export default async function DashboardPage() {
  const session = await getSession();
  if (!session) redirect("/login");
  const { cookies } = await import("next/headers");
  const cookie = (await cookies()).toString();
  const bookings = await loadMyBookings(cookie);
  const isSuperAdmin = session.roles.includes("SUPER_ADMIN");

  return (
    <main>
      <SiteHeader session={session} />
      <section className="page-band">
        <div className="page-heading">
          <span className="kicker">Your account</span>
          <h1>Welcome, {session.displayName}</h1>
          <p className="page-sub">{session.email}</p>
        </div>

        <div className="dashboard-links">
          <Link className="button button-secondary button-small" href="/manage">
            Manage venue
          </Link>
          {isSuperAdmin ? (
            <Link className="button button-secondary button-small" href="/admin">
              Admin approvals
            </Link>
          ) : null}
        </div>

        <h2 className="section-title">Your bookings</h2>
        <BookingList bookings={bookings} />
      </section>
    </main>
  );
}
