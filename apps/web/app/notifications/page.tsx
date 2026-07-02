import { redirect } from "next/navigation";
import { NotificationList } from "../../components/notification-list";
import { WorkspaceShell } from "../../components/workspace-shell";
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
    <WorkspaceShell
      kicker="Updates"
      session={session}
      sub="Booking, payment, refund, and coaching updates."
      title="Notifications"
    >
      <NotificationList initial={items} />
    </WorkspaceShell>
  );
}
