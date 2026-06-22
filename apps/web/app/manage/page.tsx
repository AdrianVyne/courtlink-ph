import { redirect } from "next/navigation";
import { PromotionManager } from "../../components/promotion-manager";
import { SiteHeader } from "../../components/site-header";
import { VenueQueue } from "../../components/venue-queue";
import { type BookingListItem, type Promotion, type VenueSummary, apiFetch } from "../../lib/api";
import { getSession } from "../../lib/session";

export const dynamic = "force-dynamic";

interface ManagedVenue {
  membershipRole: string;
  venue: VenueSummary;
}

async function load<T>(path: string, cookie: string, fallback: T): Promise<T> {
  try {
    return await apiFetch<T>(path, { cookie });
  } catch {
    return fallback;
  }
}

export default async function ManagePage() {
  const session = await getSession();
  if (!session) redirect("/login");
  const { cookies } = await import("next/headers");
  const cookie = (await cookies()).toString();

  const [queue, mine] = await Promise.all([
    load<BookingListItem[]>("/courts/bookings/queue", cookie, []),
    load<ManagedVenue[]>("/venues/mine", cookie, []),
  ]);

  const manageable = mine.filter(
    (m) => m.membershipRole === "OWNER" || m.membershipRole === "MANAGER",
  );
  const promosByVenue = await Promise.all(
    manageable.map(async (m) => ({
      venue: m.venue,
      promotions: await load<Promotion[]>(`/promotions/venues/${m.venue.id}`, cookie, []),
    })),
  );

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

        {promosByVenue.map(({ venue, promotions }) => (
          <div className="venue-promo-block" key={venue.id}>
            <h2 className="section-title">{venue.name}</h2>
            <PromotionManager venueId={venue.id} promotions={promotions} />
          </div>
        ))}
      </section>
    </main>
  );
}
