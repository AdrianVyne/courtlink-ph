import { redirect } from "next/navigation";
import { SiteHeader } from "../../components/site-header";
import { VenueQueue } from "../../components/venue-queue";
import { type BookingListItem, apiFetch } from "../../lib/api";
import { getSession } from "../../lib/session";

export const dynamic = "force-dynamic";

async function loadQueue(cookie: string): Promise<BookingListItem[]> {
  try {
    return await apiFetch<BookingListItem[]>("/courts/bookings/queue", { cookie });
  } catch {
    return [];
  }
}

export default async function ManagePage() {
  const session = await getSession();
  if (!session) redirect("/login");
  const { cookies } = await import("next/headers");
  const cookie = (await cookies()).toString();
  const queue = await loadQueue(cookie);

  return (
    <main>
      <SiteHeader session={session} />
      <section className="page-band">
        <div className="page-heading">
          <span className="kicker">Venue operations</span>
          <h1>Review queue</h1>
          <p className="page-sub">Approve payment proofs and handle refund requests.</p>
        </div>
        <VenueQueue bookings={queue} />
      </section>
    </main>
  );
}
