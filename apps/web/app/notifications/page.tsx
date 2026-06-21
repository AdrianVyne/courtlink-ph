import { redirect } from "next/navigation";
import { NotificationList } from "../../components/notification-list";
import { SiteHeader } from "../../components/site-header";
import { type NotificationItem, apiFetch } from "../../lib/api";
import { getSession } from "../../lib/session";

export const dynamic = "force-dynamic";

async function load(cookie: string): Promise<NotificationItem[]> {
  try {
    return await apiFetch<NotificationItem[]>("/notifications", { cookie });
  } catch {
    return [];
  }
}

export default async function NotificationsPage() {
  const session = await getSession();
  if (!session) redirect("/login");
  const { cookies } = await import("next/headers");
  const cookie = (await cookies()).toString();
  const items = await load(cookie);

  return (
    <main>
      <SiteHeader session={session} />
      <section className="page-band">
        <div className="page-heading">
          <span className="kicker">Updates</span>
          <h1>Notifications</h1>
          <p className="page-sub">Booking, payment, refund, and coaching updates.</p>
        </div>
        <NotificationList initial={items} />
      </section>
    </main>
  );
}
