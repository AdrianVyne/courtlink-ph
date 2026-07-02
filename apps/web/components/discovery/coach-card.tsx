import { BadgeCheck } from "lucide-react";
import Link from "next/link";
import type { CoachProfileSummary } from "../../lib/api";
import { peso } from "../../lib/format";
import { Avatar } from "../ui";

export function CoachCard({ coach }: { coach: CoachProfileSummary }) {
  return (
    <Link
      className="flex h-full flex-col gap-3 rounded-(--radius-card) border border-sand-200 bg-white p-5 transition-colors hover:border-court-400"
      href={`/coaches/${coach.id}`}
    >
      <div className="flex items-center gap-3">
        <Avatar name="Coach" />
        <div className="flex flex-col">
          <h2 className="m-0 text-base font-semibold text-ink-900">Coach</h2>
          {coach.verificationStatus === "VERIFIED" ? (
            <span className="flex items-center gap-1 text-xs font-semibold text-court-700">
              <BadgeCheck aria-hidden="true" size={13} /> Verified
            </span>
          ) : (
            <span className="text-xs text-ink-500">Unverified</span>
          )}
        </div>
      </div>
      {coach.bio ? (
        <p className="m-0 line-clamp-3 text-[0.9rem] text-ink-700">{coach.bio}</p>
      ) : null}
      <p className="tnum m-0 mt-auto font-semibold text-ink-900">{peso(coach.hourlyRate)}/hour</p>
    </Link>
  );
}
