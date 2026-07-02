import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { BookingList } from "../../components/booking-list";
import { Button } from "../../components/ui";
import { WorkspaceShell } from "../../components/workspace-shell";
import { type BookingListItem, apiFetch } from "../../lib/api";
import { getSession } from "../../lib/session";

export const dynamic = "force-dynamic";

export const metadata: Metadata = { title: "Your dashboard" };

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
    <WorkspaceShell
      actions={
        <>
          <Button href="/manage" size="sm" variant="secondary">
            Manage venue
          </Button>
          <Button href="/coach" size="sm" variant="secondary">
            Coach workspace
          </Button>
          <Button href="/coach-requests" size="sm" variant="secondary">
            Find a coach
          </Button>
          {isSuperAdmin ? (
            <Button href="/admin" size="sm" variant="secondary">
              Admin approvals
            </Button>
          ) : null}
        </>
      }
      kicker="Your account"
      session={session}
      sub={session.email}
      title={`Welcome, ${session.displayName}`}
    >
      <h2 className="m-0 mb-4 font-display text-xl font-bold text-ink-900">Your bookings</h2>
      <BookingList bookings={bookings} />
    </WorkspaceShell>
  );
}
