import Link from "next/link";
import type { BookingListItem } from "../lib/api";
import { peso } from "../lib/format";
import { ReviewForm } from "./review-form";
import { Button, Card, Countdown, EmptyState, StatusPill } from "./ui";

function formatWhen(iso: string): string {
  return new Date(iso).toLocaleString("en-PH", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: "Asia/Manila",
  });
}

export function BookingList({ bookings }: { bookings: BookingListItem[] }) {
  if (bookings.length === 0) {
    return (
      <EmptyState
        action={<Button href="/courts">Find a court</Button>}
        body="Your court reservations will show up here."
        title="No bookings yet"
      />
    );
  }
  return (
    <ul className="m-0 flex list-none flex-col gap-3 p-0">
      {bookings.map((booking) => (
        <li key={booking.id}>
          <Card className="flex flex-wrap items-center justify-between gap-4 px-5 py-4">
            <div className="flex flex-col gap-0.5">
              <strong className="text-ink-900">{booking.court.name}</strong>
              <Link
                className="text-sm text-ink-500 hover:text-court-800"
                href={`/courts/${booking.venue.slug}`}
              >
                {booking.venue.name}
              </Link>
              <span className="text-sm text-ink-700">{formatWhen(booking.startsAt)}</span>
              {booking.status === "HELD" && booking.proofDeadline ? (
                <span className="mt-1 text-sm font-semibold text-pending-fg">
                  Proof due in <Countdown until={booking.proofDeadline} />
                </span>
              ) : null}
              {booking.status === "COMPLETED" && !booking.reviewed ? (
                <ReviewForm scope="courts" bookingId={booking.id} />
              ) : null}
            </div>
            <div className="flex flex-col items-end gap-1.5">
              <StatusPill status={booking.status} />
              <span className="tnum font-semibold text-ink-900">{peso(booking.quotedAmount)}</span>
            </div>
          </Card>
        </li>
      ))}
    </ul>
  );
}
