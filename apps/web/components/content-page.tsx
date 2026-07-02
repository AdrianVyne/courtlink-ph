import type { ReactNode } from "react";
import { getSession } from "../lib/session";
import { SiteFooter } from "./site-footer";
import { SiteHeader } from "./site-header";
import { CourtLines } from "./ui";

interface ContentPageProps {
  eyebrow: string;
  title: string;
  lede?: string;
  updated?: string;
  children: ReactNode;
}

/** Shared shell for static trust/content pages (/about, /terms, ...). */
export async function ContentPage({ eyebrow, title, lede, updated, children }: ContentPageProps) {
  const session = await getSession();
  return (
    <>
      <SiteHeader session={session} />
      <main className="mx-auto w-full max-w-3xl px-[5vw] py-12">
        <header className="relative">
          <CourtLines
            className="pointer-events-none absolute -top-6 right-0 w-40 text-court-200"
            variant="corner"
          />
          <span className="text-xs font-bold uppercase tracking-widest text-court-700">
            {eyebrow}
          </span>
          <h1 className="m-0 mt-2 font-display text-4xl font-bold tracking-tight text-ink-900">
            {title}
          </h1>
          {lede ? <p className="m-0 mt-3 text-lg leading-relaxed text-ink-500">{lede}</p> : null}
          {updated ? <p className="m-0 mt-2 text-sm text-ink-500">Last updated {updated}</p> : null}
        </header>
        <div className="mt-10 flex flex-col gap-4 leading-relaxed text-ink-700 [&_a]:font-semibold [&_a]:text-court-700 [&_a]:underline [&_h2]:m-0 [&_h2]:mt-6 [&_h2]:font-display [&_h2]:text-2xl [&_h2]:font-bold [&_h2]:tracking-tight [&_h2]:text-ink-900 [&_h3]:m-0 [&_h3]:mt-4 [&_h3]:text-lg [&_h3]:font-semibold [&_h3]:text-ink-900 [&_li]:mt-1.5 [&_p]:m-0 [&_ul]:m-0 [&_ul]:list-disc [&_ul]:pl-5">
          {children}
        </div>
      </main>
      <SiteFooter />
    </>
  );
}
