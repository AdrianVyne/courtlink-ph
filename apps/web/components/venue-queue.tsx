"use client";

import { Check, RotateCcw, X } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { ApiError, type BookingListItem, apiFetch } from "../lib/api";

function formatWhen(iso: string): string {
  return new Date(iso).toLocaleString("en-PH", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: "Asia/Manila",
  });
}

export function VenueQueue({ bookings }: { bookings: BookingListItem[] }) {
  const router = useRouter();
  const [pendingId, setPendingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function run(id: string, action: () => Promise<unknown>) {
    setPendingId(id);
    setError(null);
    try {
      await action();
      router.refresh();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Action failed.");
    } finally {
      setPendingId(null);
    }
  }

  if (bookings.length === 0) {
    return <p className="empty-state">Nothing to review right now.</p>;
  }

  return (
    <div className="queue-list">
      {error ? (
        <p className="form-error" role="alert">
          {error}
        </p>
      ) : null}
      {bookings.map((booking) => {
        const busy = pendingId === booking.id;
        return (
          <article className="queue-card" key={booking.id}>
            <div className="queue-head">
              <strong>
                {booking.court.name} - {booking.venue.name}
              </strong>
              <span className={`status-pill status-${booking.status.toLowerCase()}`}>
                {booking.status}
              </span>
            </div>
            <p className="queue-when">{formatWhen(booking.startsAt)}</p>
            <p className="queue-amount">
              {booking.currency} {booking.quotedAmount.toFixed(2)}
            </p>

            {booking.status === "PROOF_SUBMITTED" && booking.submission ? (
              <div className="queue-proof">
                <span>
                  {booking.submission.channel} ref {booking.submission.transactionRef}
                </span>
                <div className="queue-actions">
                  <button
                    className="button button-small"
                    type="button"
                    disabled={busy}
                    onClick={() =>
                      run(booking.id, () =>
                        apiFetch("/courts/bookings/proof/approve", {
                          method: "POST",
                          body: { submissionId: booking.submission?.id, bookingId: booking.id },
                        }),
                      )
                    }
                  >
                    <Check size={16} aria-hidden="true" /> Approve
                  </button>
                  <button
                    className="button button-secondary button-small"
                    type="button"
                    disabled={busy}
                    onClick={() => {
                      const reason = window.prompt("Reason for rejecting this payment proof?");
                      if (!reason) return;
                      void run(booking.id, () =>
                        apiFetch("/courts/bookings/proof/reject", {
                          method: "POST",
                          body: {
                            submissionId: booking.submission?.id,
                            bookingId: booking.id,
                            reason,
                          },
                        }),
                      );
                    }}
                  >
                    <X size={16} aria-hidden="true" /> Reject
                  </button>
                </div>
              </div>
            ) : null}

            {booking.status === "REFUND_REQUESTED" && booking.refund ? (
              <div className="queue-proof">
                <span>
                  Refund {booking.currency} {booking.refund.amount.toFixed(2)} -{" "}
                  {booking.refund.status}
                </span>
                <div className="queue-actions">
                  <button
                    className="button button-small"
                    type="button"
                    disabled={busy}
                    onClick={() =>
                      run(booking.id, () =>
                        apiFetch("/courts/bookings/refund/decide", {
                          method: "POST",
                          body: {
                            refundId: booking.refund?.id,
                            bookingId: booking.id,
                            decision: "APPROVED",
                          },
                        }),
                      )
                    }
                  >
                    <Check size={16} aria-hidden="true" /> Approve refund
                  </button>
                  <button
                    className="button button-secondary button-small"
                    type="button"
                    disabled={busy}
                    onClick={() =>
                      run(booking.id, () =>
                        apiFetch("/courts/bookings/refund/decide", {
                          method: "POST",
                          body: {
                            refundId: booking.refund?.id,
                            bookingId: booking.id,
                            decision: "REJECTED",
                          },
                        }),
                      )
                    }
                  >
                    <X size={16} aria-hidden="true" /> Reject refund
                  </button>
                </div>
              </div>
            ) : null}

            <button
              className="text-button queue-cancel"
              type="button"
              disabled={busy}
              onClick={() => {
                const reason = window.prompt("Reason for cancelling this booking?");
                if (!reason) return;
                void run(booking.id, () =>
                  apiFetch("/courts/bookings/cancel-by-venue", {
                    method: "POST",
                    body: { bookingId: booking.id, reason },
                  }),
                );
              }}
            >
              <RotateCcw size={14} aria-hidden="true" /> Cancel and refund
            </button>
          </article>
        );
      })}
    </div>
  );
}
