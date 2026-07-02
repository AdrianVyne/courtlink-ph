"use client";

import { Check, RotateCcw, X } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { ApiError, type BookingListItem, apiFetch } from "../lib/api";
import { peso } from "../lib/format";
import { Button, Card, EmptyState, StatusPill, useToast } from "./ui";

function formatWhen(iso: string): string {
  return new Date(iso).toLocaleString("en-PH", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: "Asia/Manila",
  });
}

export function VenueQueue({ bookings }: { bookings: BookingListItem[] }) {
  const router = useRouter();
  const { push } = useToast();
  const [pendingId, setPendingId] = useState<string | null>(null);

  async function run(id: string, done: string, action: () => Promise<unknown>) {
    setPendingId(id);
    try {
      await action();
      push(done);
      router.refresh();
    } catch (err) {
      push(err instanceof ApiError ? err.message : "Action failed.", "danger");
    } finally {
      setPendingId(null);
    }
  }

  if (bookings.length === 0) {
    return (
      <EmptyState
        body="Proof submissions and refund requests appear here as they come in."
        title="Nothing to review right now"
      />
    );
  }

  return (
    <div className="grid gap-4 md:grid-cols-2">
      {bookings.map((booking) => {
        const busy = pendingId === booking.id;
        return (
          <Card className="flex flex-col gap-2 p-5" key={booking.id}>
            <div className="flex items-center justify-between gap-3">
              <strong className="text-ink-900">
                {booking.court.name} — {booking.venue.name}
              </strong>
              <StatusPill status={booking.status} />
            </div>
            <p className="m-0 text-sm text-ink-700">{formatWhen(booking.startsAt)}</p>
            <p className="tnum m-0 text-sm font-semibold text-ink-900">
              {peso(booking.quotedAmount)}
            </p>

            {booking.status === "PROOF_SUBMITTED" && booking.submission ? (
              <div className="flex flex-col gap-2">
                <span className="text-sm text-ink-700">
                  {booking.submission.channel} ref {booking.submission.transactionRef}
                </span>
                <div className="flex flex-wrap gap-2">
                  <Button
                    loading={busy}
                    onClick={() =>
                      run(booking.id, "Proof approved.", () =>
                        apiFetch("/courts/bookings/proof/approve", {
                          method: "POST",
                          body: { submissionId: booking.submission?.id, bookingId: booking.id },
                        }),
                      )
                    }
                    size="sm"
                  >
                    <Check aria-hidden="true" size={16} /> Approve
                  </Button>
                  <Button
                    disabled={busy}
                    onClick={() => {
                      const reason = window.prompt("Reason for rejecting this payment proof?");
                      if (!reason) return;
                      void run(booking.id, "Proof rejected.", () =>
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
                    size="sm"
                    variant="secondary"
                  >
                    <X aria-hidden="true" size={16} /> Reject
                  </Button>
                </div>
              </div>
            ) : null}

            {booking.status === "REFUND_REQUESTED" && booking.refund ? (
              <div className="flex flex-col gap-2">
                <span className="tnum text-sm text-ink-700">
                  Refund {peso(booking.refund.amount)} — {booking.refund.status}
                </span>
                <div className="flex flex-wrap gap-2">
                  <Button
                    loading={busy}
                    onClick={() =>
                      run(booking.id, "Refund approved.", () =>
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
                    size="sm"
                  >
                    <Check aria-hidden="true" size={16} /> Approve refund
                  </Button>
                  <Button
                    disabled={busy}
                    onClick={() =>
                      run(booking.id, "Refund rejected.", () =>
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
                    size="sm"
                    variant="secondary"
                  >
                    <X aria-hidden="true" size={16} /> Reject refund
                  </Button>
                </div>
              </div>
            ) : null}

            <Button
              className="mt-1 self-start"
              disabled={busy}
              onClick={() => {
                const reason = window.prompt("Reason for cancelling this booking?");
                if (!reason) return;
                void run(booking.id, "Booking cancelled and marked for refund.", () =>
                  apiFetch("/courts/bookings/cancel-by-venue", {
                    method: "POST",
                    body: { bookingId: booking.id, reason },
                  }),
                );
              }}
              size="sm"
              variant="danger"
            >
              <RotateCcw aria-hidden="true" size={14} /> Cancel and refund
            </Button>
          </Card>
        );
      })}
    </div>
  );
}
