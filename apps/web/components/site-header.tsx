import Link from "next/link";
import type { SessionUser } from "../lib/api";
import { LogoutButton } from "./logout-button";
import { MobileNav } from "./mobile-nav";
import { NavLinks } from "./nav-links";
import { NotificationBell } from "./notification-bell";

export function SiteHeader({ session }: { session: SessionUser | null }) {
  return (
    <header className="sticky top-0 z-10 grid min-h-18 grid-cols-[1fr_auto] items-center border-b border-sand-200 bg-white/90 px-[5vw] backdrop-blur md:grid-cols-[1fr_auto_1fr]">
      <Link
        aria-label="CourtLink PH home"
        className="flex items-center gap-2.5 text-[1.05rem] font-bold"
        href="/"
      >
        <span className="inline-flex size-8 items-center justify-center rounded-lg bg-court-700 text-xs font-extrabold tracking-tight text-white">
          CL
        </span>
        <span className="font-display">CourtLink PH</span>
      </Link>
      <NavLinks className="hidden gap-8 md:flex" />
      <div className="flex items-center justify-end gap-3">
        {session ? (
          <>
            <NotificationBell />
            <Link
              className="hidden text-sm font-semibold text-ink-700 hover:text-court-800 md:inline"
              href="/dashboard"
            >
              {session.displayName}
            </Link>
            <span className="hidden md:inline-flex">
              <LogoutButton />
            </span>
          </>
        ) : (
          <>
            <Link
              className="hidden text-sm font-semibold text-ink-700 hover:text-court-800 md:inline"
              href="/login"
            >
              Log in
            </Link>
            <Link
              className="hidden min-h-10 items-center justify-center rounded-(--radius-control) bg-court-700 px-4 text-sm font-semibold text-white transition-colors hover:bg-court-800 md:inline-flex"
              href="/register"
            >
              Join CourtLink
            </Link>
          </>
        )}
        <MobileNav session={session} />
      </div>
    </header>
  );
}
