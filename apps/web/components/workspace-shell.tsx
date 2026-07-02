import type { ReactNode } from "react";
import type { SessionUser } from "../lib/api";
import { SiteFooter } from "./site-footer";
import { SiteHeader } from "./site-header";

/** Shared frame for signed-in workspace pages. */
export function WorkspaceShell({
  session,
  kicker,
  title,
  sub,
  actions,
  children,
}: {
  session: SessionUser | null;
  kicker: string;
  title: string;
  sub?: string;
  actions?: ReactNode;
  children: ReactNode;
}) {
  return (
    <>
      <SiteHeader session={session} />
      <main className="mx-auto w-full max-w-6xl px-[5vw] py-10">
        <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
          <div>
            <span className="text-xs font-bold uppercase tracking-widest text-court-700">
              {kicker}
            </span>
            <h1 className="m-0 mt-1 font-display text-3xl font-bold tracking-tight text-ink-900 sm:text-4xl">
              {title}
            </h1>
            {sub ? <p className="m-0 mt-2 text-ink-500">{sub}</p> : null}
          </div>
          {actions ? <div className="flex flex-wrap gap-2">{actions}</div> : null}
        </div>
        {children}
      </main>
      <SiteFooter />
    </>
  );
}
