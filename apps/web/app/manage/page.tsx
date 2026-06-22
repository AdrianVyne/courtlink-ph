import { redirect } from "next/navigation";
import { CourtScheduleManager } from "../../components/court-schedule-manager";
import { PromotionManager } from "../../components/promotion-manager";
import { VenueAmenityManager } from "../../components/venue-amenity-manager";
import { SiteHeader } from "../../components/site-header";
import { VenueQueue } from "../../components/venue-queue";
import {
  type AmenityCatalogEntry,
  type BookingListItem,
  type CourtSchedule,
  type CourtSummary,
  type Promotion,
  type VenueSummary,
  apiFetch,
} from "../../lib/api";
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

  const [queue, mine, amenityCatalog] = await Promise.all([
    load<BookingListItem[]>("/courts/bookings/queue", cookie, []),
    load<ManagedVenue[]>("/venues/mine", cookie, []),
    load<AmenityCatalogEntry[]>("/amenities", cookie, []),
  ]);

  const manageable = mine.filter(
    (m) => m.membershipRole === "OWNER" || m.membershipRole === "MANAGER",
  );
  const workspaces = await Promise.all(
    manageable.map(async (membership) => {
      const [promotions, courts, venueAmenities] = await Promise.all([
        load<Promotion[]>(`/promotions/venues/${membership.venue.id}`, cookie, []),
        load<CourtSummary[]>(`/courts/venues/${membership.venue.id}/list`, cookie, []),
        load<{ amenities: string[] }>(`/venues/${membership.venue.id}/amenities`, cookie, {
          amenities: [],
        }),
      ]);
      const schedules = await Promise.all(
        courts.map(async (court) => ({
          court,
          schedule: await load<CourtSchedule | null>(`/courts/${court.id}/schedule`, cookie, null),
        })),
      );
      return { membership, promotions, schedules, venueAmenities };
    }),
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

        {workspaces.map(({ membership, promotions, schedules, venueAmenities }) => (
          <div className="venue-workspace" key={membership.venue.id}>
            <h2 className="section-title">{membership.venue.name}</h2>
            <section aria-labelledby={`schedule-${membership.venue.id}`}>
              <h3 className="workspace-title" id={`schedule-${membership.venue.id}`}>
                Court schedules
              </h3>
              {schedules.length === 0 ? (
                <p className="empty-state">No courts are configured for this venue.</p>
              ) : (
                <div className="schedule-grid">
                  {schedules.map(({ court, schedule }) =>
                    schedule ? (
                      <CourtScheduleManager
                        key={court.id}
                        court={court}
                        schedule={schedule}
                        canEdit={
                          membership.membershipRole === "OWNER" ||
                          membership.membershipRole === "MANAGER"
                        }
                      />
                    ) : (
                      <article className="schedule-manager" key={court.id}>
                        <h3>{court.name}</h3>
                        <p className="form-error">Schedule unavailable. Reload before editing.</p>
                      </article>
                    ),
                  )}
                </div>
              )}
            </section>
            <VenueAmenityManager
              venueId={membership.venue.id}
              catalog={amenityCatalog}
              selected={venueAmenities.amenities}
            />
            <PromotionManager venueId={membership.venue.id} promotions={promotions} />
          </div>
        ))}
      </section>
    </main>
  );
}
