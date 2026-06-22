"use client";

import { Check, X } from "lucide-react";
import { useRouter } from "next/navigation";
import { type FormEvent, useState } from "react";
import {
  ApiError,
  type AvailabilitySlot,
  type CoachBookingListItem,
  type CoachMe,
  type OpenCoachJob,
  apiFetch,
} from "../lib/api";

function formatWhen(iso: string): string {
  return new Date(iso).toLocaleString("en-PH", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: "Asia/Manila",
  });
}

export function CoachWorkspace({
  me,
  jobs,
  bookings,
}: {
  me: CoachMe;
  jobs: OpenCoachJob[];
  bookings: CoachBookingListItem[];
}) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function call(action: () => Promise<unknown>) {
    setPending(true);
    setError(null);
    try {
      await action();
      router.refresh();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Action failed.");
    } finally {
      setPending(false);
    }
  }

  async function saveProfile(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    await call(() =>
      apiFetch("/coaches/profile", {
        method: "POST",
        body: {
          bio: String(form.get("bio") ?? "") || null,
          experience: String(form.get("experience") ?? "") || null,
          hourlyRate: Number(form.get("hourlyRate") ?? 0),
        },
      }),
    );
  }

  async function addAvailability(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const start = String(form.get("startsAt") ?? "");
    const end = String(form.get("endsAt") ?? "");
    await call(() =>
      apiFetch("/coaches/availability", {
        method: "POST",
        body: {
          startsAt: new Date(start).toISOString(),
          endsAt: new Date(end).toISOString(),
          location: String(form.get("location") ?? ""),
        },
      }),
    );
  }

  async function makeOffer(job: OpenCoachJob, event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    await call(() =>
      apiFetch("/coaches/offers", {
        method: "POST",
        body: {
          requestId: job.id,
          amount: Number(form.get("amount") ?? 0),
          expiresAt: new Date(String(form.get("expiresAt") ?? "")).toISOString(),
          message: String(form.get("message") ?? "") || null,
        },
      }),
    );
  }

  return (
    <div className="coach-workspace">
      {error ? (
        <p className="form-error" role="alert">
          {error}
        </p>
      ) : null}

      <h2 className="section-title">Your coach profile</h2>
      <form className="stack-form" onSubmit={saveProfile}>
        <label className="field">
          <span className="field-label">Hourly rate (PHP)</span>
          <input
            name="hourlyRate"
            type="number"
            min={1}
            step="0.01"
            defaultValue={me.profile?.hourlyRate ?? 800}
            required
          />
        </label>
        <label className="field">
          <span className="field-label">Bio</span>
          <input name="bio" type="text" defaultValue={me.profile?.bio ?? ""} maxLength={2000} />
        </label>
        <label className="field">
          <span className="field-label">Experience</span>
          <input
            name="experience"
            type="text"
            defaultValue={me.profile?.experience ?? ""}
            maxLength={2000}
          />
        </label>
        <button className="button button-small" type="submit" disabled={pending}>
          {me.profile ? "Update profile" : "Create profile"}
        </button>
      </form>

      {me.profile ? (
        <>
          <h2 className="section-title">Availability</h2>
          <AvailabilityList slots={me.availability} />
          <form className="row-form" onSubmit={addAvailability}>
            <label className="field">
              <span className="field-label">Start</span>
              <input name="startsAt" type="datetime-local" required />
            </label>
            <label className="field">
              <span className="field-label">End</span>
              <input name="endsAt" type="datetime-local" required />
            </label>
            <label className="field">
              <span className="field-label">Location</span>
              <input name="location" type="text" required minLength={2} />
            </label>
            <button
              className="button button-secondary button-small"
              type="submit"
              disabled={pending}
            >
              Add slot
            </button>
          </form>

          <h2 className="section-title">Open coaching jobs</h2>
          {jobs.length === 0 ? (
            <p className="empty-state">No open requests right now.</p>
          ) : (
            <div className="queue-list">
              {jobs.map((job) => (
                <article className="queue-card" key={job.id}>
                  <div className="queue-head">
                    <strong>
                      {job.groupSize} players - {job.skillLevel}
                    </strong>
                  </div>
                  <p className="queue-when">
                    {formatWhen(job.startsAt)} at {job.location}
                  </p>
                  <form className="row-form" onSubmit={(e) => makeOffer(job, e)}>
                    <label className="field">
                      <span className="field-label">Your price (PHP)</span>
                      <input name="amount" type="number" min={1} step="0.01" required />
                    </label>
                    <label className="field">
                      <span className="field-label">Offer expires</span>
                      <input name="expiresAt" type="datetime-local" required />
                    </label>
                    <button className="button button-small" type="submit" disabled={pending}>
                      Send offer
                    </button>
                  </form>
                </article>
              ))}
            </div>
          )}

          <h2 className="section-title">Your coaching bookings</h2>
          {bookings.length === 0 ? (
            <p className="empty-state">No coaching bookings yet.</p>
          ) : (
            <div className="queue-list">
              {bookings.map((booking) => (
                <article className="queue-card" key={booking.id}>
                  <div className="queue-head">
                    <strong>{booking.player.displayName}</strong>
                    <span className={`status-pill status-${booking.status.toLowerCase()}`}>
                      {booking.status}
                    </span>
                  </div>
                  <p className="queue-when">
                    {formatWhen(booking.startsAt)} at {booking.location}
                  </p>
                  <p className="queue-amount">
                    {booking.currency} {booking.amount.toFixed(2)}
                  </p>
                  {booking.status === "PROOF_SUBMITTED" && booking.submission ? (
                    <div className="queue-actions">
                      <button
                        className="button button-small"
                        type="button"
                        disabled={pending}
                        onClick={() =>
                          call(() =>
                            apiFetch("/coaches/bookings/proof/approve", {
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
                        disabled={pending}
                        onClick={() => {
                          const reason = window.prompt("Reason for rejecting?");
                          if (!reason) return;
                          void call(() =>
                            apiFetch("/coaches/bookings/proof/reject", {
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
                  ) : null}
                </article>
              ))}
            </div>
          )}
        </>
      ) : null}
    </div>
  );
}

function AvailabilityList({ slots }: { slots: AvailabilitySlot[] }) {
  if (slots.length === 0) return <p className="empty-state">No availability posted yet.</p>;
  return (
    <ul className="booking-list">
      {slots.map((slot) => (
        <li className="booking-row" key={slot.id}>
          <span>{formatWhen(slot.startsAt)}</span>
          <span className="booking-venue">{slot.location}</span>
        </li>
      ))}
    </ul>
  );
}
