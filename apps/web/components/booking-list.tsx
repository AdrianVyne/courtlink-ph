import type { BookingListItem } from "../lib/api";
import { ReviewForm } from "./review-form";

const STATUS_LABEL: Record<string, string> = {
  HELD: "Hold (awaiting proof)",
  PROOF_SUBMITTED: "Under review",
  CONFIRMED: "Confirmed",
  REJECTED: "Proof rejected",
  EXPIRED: "Expired",
  CANCELLED: "Cancelled",
  COMPLETED: "Completed",
  REFUND_REQUESTED: "Refund requested",
};

function formatWhen(iso: string): string {
  return new Date(iso).toLocaleString("en-PH", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: "Asia/Manila",
  });
}

export function BookingList({ bookings }: { bookings: BookingListItem[] }) {
  if (bookings.length === 0) {
    return <p className="empty-state">No bookings yet. Find a court to get started.</p>;
  }
  return (
    <ul className="booking-list">
      {bookings.map((booking) => (
        <li className="booking-row" key={booking.id}>
          <div className="booking-main">
            <strong>{booking.court.name}</strong>
            <span className="booking-venue">{booking.venue.name}</span>
            <span className="booking-when">{formatWhen(booking.startsAt)}</span>
            {booking.status === "COMPLETED" && !booking.reviewed ? (
              <ReviewForm scope="courts" bookingId={booking.id} />
            ) : null}
          </div>
          <div className="booking-meta">
            <span className={`status-pill status-${booking.status.toLowerCase()}`}>
              {STATUS_LABEL[booking.status] ?? booking.status}
            </span>
            <span className="booking-amount">
              {booking.currency} {booking.quotedAmount.toFixed(2)}
            </span>
          </div>
        </li>
      ))}
    </ul>
  );
}
