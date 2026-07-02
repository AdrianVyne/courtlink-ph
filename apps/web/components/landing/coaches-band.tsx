import { ArrowRight, BadgeCheck } from "lucide-react";
import Link from "next/link";
import type { CoachProfileSummary } from "../../lib/api";
import { peso } from "../../lib/format";
import { Avatar, Button } from "../ui";

export function CoachesBand({ coaches }: { coaches: CoachProfileSummary[] }) {
  return (
    <section aria-labelledby="coaches-band" className="bg-court-950 px-[5vw] py-20 text-sand-100">
      <div className="mx-auto grid max-w-6xl items-center gap-10 lg:grid-cols-[1.1fr_1fr]">
        <div>
          <span className="text-xs font-bold uppercase tracking-widest text-lime-400">
            Coaching
          </span>
          <h2
            className="m-0 mt-2 font-display text-4xl font-bold tracking-tight text-white"
            id="coaches-band"
          >
            Level up with a coach who bids for your session
          </h2>
          <p className="m-0 mt-4 max-w-lg leading-relaxed text-sand-100/75">
            Book a coach directly, or post what you need — date, place, group size, goals — and let
            coaches compete with priced offers. You pick one; everyone else is closed out
            automatically.
          </p>
          <div className="mt-7 flex flex-wrap gap-3">
            <Button
              className="!bg-lime-400 !border-lime-400 !text-court-950 hover:!bg-lime-300"
              href="/coach-requests"
            >
              Post an open request
            </Button>
            <Button
              className="!border-white/30 !text-white hover:!bg-white/10"
              href="/coaches"
              variant="secondary"
            >
              Browse coaches <ArrowRight aria-hidden="true" size={16} />
            </Button>
          </div>
        </div>
        {coaches.length > 0 ? (
          <ul className="m-0 grid list-none gap-3 p-0 sm:grid-cols-2">
            {coaches.slice(0, 4).map((coach, index) => (
              <li key={coach.id}>
                <Link
                  className="flex h-full flex-col gap-3 rounded-(--radius-card) border border-white/12 bg-white/5 p-5 transition-colors hover:border-lime-400/50"
                  href={`/coaches/${coach.id}`}
                >
                  <div className="flex items-center gap-3">
                    <Avatar name={`Coach ${index + 1}`} />
                    <div className="flex flex-col">
                      <span className="font-semibold text-white">Coach</span>
                      {coach.verificationStatus === "VERIFIED" ? (
                        <span className="flex items-center gap-1 text-xs font-semibold text-lime-400">
                          <BadgeCheck aria-hidden="true" size={13} /> Verified
                        </span>
                      ) : (
                        <span className="text-xs text-sand-100/60">Community coach</span>
                      )}
                    </div>
                  </div>
                  {coach.bio ? (
                    <p className="m-0 line-clamp-2 text-sm text-sand-100/70">{coach.bio}</p>
                  ) : null}
                  <p className="tnum m-0 mt-auto font-semibold text-white">
                    {peso(coach.hourlyRate)}/hour
                  </p>
                </Link>
              </li>
            ))}
          </ul>
        ) : null}
      </div>
    </section>
  );
}
