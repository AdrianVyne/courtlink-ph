import Link from "next/link";
import type { SessionUser } from "../lib/api";
import { LogoutButton } from "./logout-button";
import { NotificationBell } from "./notification-bell";

export function SiteHeader({ session }: { session: SessionUser | null }) {
  return (
    <header className="site-header">
      <Link className="brand" href="/" aria-label="CourtLink PH home">
        <span className="brand-mark">CL</span>
        <span>CourtLink PH</span>
      </Link>
      <nav aria-label="Primary navigation">
        <Link href="/courts">Courts</Link>
        <Link href="/coaches">Coaches</Link>
        <Link href="/coach-requests">Find players</Link>
      </nav>
      <div className="header-actions">
        {session ? (
          <>
            <NotificationBell />
            <Link className="text-button" href="/dashboard">
              {session.displayName}
            </Link>
            <LogoutButton />
          </>
        ) : (
          <>
            <Link className="text-button" href="/login">
              Log in
            </Link>
            <Link className="button button-small" href="/register">
              Join CourtLink
            </Link>
          </>
        )}
      </div>
    </header>
  );
}
