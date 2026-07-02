import type { PublicStats } from "../../lib/api";
import { Stat } from "../ui";

export function ProofStrip({ stats }: { stats: PublicStats | null }) {
  if (!stats) return null;

  return (
    <section aria-label="CourtLink today" className="border-y border-sand-200 bg-white px-[5vw]">
      <div className="mx-auto flex max-w-5xl flex-wrap items-center justify-center gap-x-16 gap-y-6 py-10">
        {stats.venues >= 3 ? (
          <>
            <Stat label="approved venues" value={String(stats.venues)} />
            <Stat label={stats.cities === 1 ? "city" : "cities"} value={String(stats.cities)} />
            <Stat label="coaches" value={String(stats.coaches)} />
          </>
        ) : (
          <p className="m-0 text-center font-display text-xl font-semibold text-court-800">
            Growing across the Philippines — new venues and coaches every week.
          </p>
        )}
      </div>
    </section>
  );
}
