"use client";

import { Ban, Check, X } from "lucide-react";
import { useRouter } from "next/navigation";
import { type FormEvent, useState } from "react";
import {
  ApiError,
  type AvailabilitySlot,
  type CoachBookingListItem,
  type CoachMe,
  type DirectedRequest,
  type OpenCoachJob,
  apiFetch,
} from "../lib/api";
import { peso } from "../lib/format";
import { Button, Card, EmptyState, Field, Input, StatusPill, useToast } from "./ui";

function formatWhen(iso: string): string {
  return new Date(iso).toLocaleString("en-PH", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: "Asia/Manila",
  });
}

function SectionTitle({ children }: { children: string }) {
  return <h2 className="m-0 mt-8 mb-4 font-display text-xl font-bold text-ink-900">{children}</h2>;
}

export function CoachWorkspace({
  me,
  jobs,
  bookings,
  directed,
}: {
  me: CoachMe;
  jobs: OpenCoachJob[];
  bookings: CoachBookingListItem[];
  directed: DirectedRequest[];
}) {
  const router = useRouter();
  const { push } = useToast();
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function call(done: string, action: () => Promise<unknown>) {
    setPending(true);
    setError(null);
    try {
      await action();
      push(done);
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
    await call("Profile saved.", () =>
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
    await call("Availability added.", () =>
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
    await call("Offer sent.", () =>
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
    <div className="flex flex-col">
      {error ? (
        <p
          className="m-0 mb-4 rounded-(--radius-control) border border-danger-fg/30 bg-danger-bg px-3 py-2.5 text-sm text-danger-fg"
          role="alert"
        >
          {error}
        </p>
      ) : null}

      <SectionTitle>Your coach profile</SectionTitle>
      <form className="flex max-w-md flex-col gap-3" onSubmit={saveProfile}>
        <Field label="Hourly rate (PHP)">
          <Input
            defaultValue={me.profile?.hourlyRate ?? 800}
            min={1}
            name="hourlyRate"
            required
            step="0.01"
            type="number"
          />
        </Field>
        <Field label="Bio">
          <Input defaultValue={me.profile?.bio ?? ""} maxLength={2000} name="bio" type="text" />
        </Field>
        <Field label="Experience">
          <Input
            defaultValue={me.profile?.experience ?? ""}
            maxLength={2000}
            name="experience"
            type="text"
          />
        </Field>
        <Button className="self-start" loading={pending} size="sm" type="submit">
          {me.profile ? "Update profile" : "Create profile"}
        </Button>
      </form>

      {me.profile ? (
        <>
          <SectionTitle>Availability</SectionTitle>
          <AvailabilityList slots={me.availability} />
          <form className="mt-3 flex flex-wrap items-end gap-3" onSubmit={addAvailability}>
            <Field label="Start">
              <Input name="startsAt" required type="datetime-local" />
            </Field>
            <Field label="End">
              <Input name="endsAt" required type="datetime-local" />
            </Field>
            <Field label="Location">
              <Input minLength={2} name="location" required type="text" />
            </Field>
            <Button loading={pending} size="sm" type="submit" variant="secondary">
              Add slot
            </Button>
          </form>

          <SectionTitle>Directed requests</SectionTitle>
          {directed.length === 0 ? (
            <EmptyState
              body="Players who pick you directly appear here for approval."
              title="No directed requests awaiting your approval"
            />
          ) : (
            <div className="grid gap-4 md:grid-cols-2">
              {directed.map((req) => (
                <Card className="flex flex-col gap-2 p-5" key={req.id}>
                  <div className="flex items-center justify-between gap-3">
                    <strong className="text-ink-900">
                      {req.player.displayName} — {req.groupSize} players
                    </strong>
                    <StatusPill status="PENDING_COACH" />
                  </div>
                  <p className="m-0 text-sm text-ink-700">
                    {formatWhen(req.startsAt)} at {req.location}
                  </p>
                  {req.goals ? <p className="m-0 text-sm text-ink-500">{req.goals}</p> : null}
                  <div className="mt-1 flex flex-wrap gap-2">
                    <Button
                      loading={pending}
                      onClick={() =>
                        call("Request approved — the player can now pay.", () =>
                          apiFetch(`/coaches/requests/${req.id}/approve`, { method: "POST" }),
                        )
                      }
                      size="sm"
                    >
                      <Check aria-hidden="true" size={16} /> Approve
                    </Button>
                    <Button
                      disabled={pending}
                      onClick={() =>
                        call("Request declined.", () =>
                          apiFetch(`/coaches/requests/${req.id}/decline`, { method: "POST" }),
                        )
                      }
                      size="sm"
                      variant="secondary"
                    >
                      <X aria-hidden="true" size={16} /> Decline
                    </Button>
                  </div>
                </Card>
              ))}
            </div>
          )}

          <SectionTitle>Open coaching jobs</SectionTitle>
          {jobs.length === 0 ? (
            <EmptyState
              body="Open player requests you can bid on will show here."
              title="No open requests right now"
            />
          ) : (
            <div className="grid gap-4 md:grid-cols-2">
              {jobs.map((job) => (
                <Card className="flex flex-col gap-2 p-5" key={job.id}>
                  <strong className="text-ink-900">
                    {job.groupSize} players — {job.skillLevel}
                  </strong>
                  <p className="m-0 text-sm text-ink-700">
                    {formatWhen(job.startsAt)} at {job.location}
                  </p>
                  <form
                    className="mt-1 flex flex-wrap items-end gap-3"
                    onSubmit={(e) => makeOffer(job, e)}
                  >
                    <Field label="Your price (PHP)">
                      <Input min={1} name="amount" required step="0.01" type="number" />
                    </Field>
                    <Field label="Offer expires">
                      <Input name="expiresAt" required type="datetime-local" />
                    </Field>
                    <Button loading={pending} size="sm" type="submit">
                      Send offer
                    </Button>
                  </form>
                </Card>
              ))}
            </div>
          )}

          <SectionTitle>Your coaching bookings</SectionTitle>
          {bookings.length === 0 ? (
            <EmptyState
              body="Accepted offers and direct bookings appear here."
              title="No coaching bookings yet"
            />
          ) : (
            <div className="grid gap-4 md:grid-cols-2">
              {bookings.map((booking) => (
                <Card className="flex flex-col gap-2 p-5" key={booking.id}>
                  <div className="flex items-center justify-between gap-3">
                    <strong className="text-ink-900">{booking.player.displayName}</strong>
                    <StatusPill status={booking.status} />
                  </div>
                  <p className="m-0 text-sm text-ink-700">
                    {formatWhen(booking.startsAt)} at {booking.location}
                  </p>
                  <p className="tnum m-0 text-sm font-semibold text-ink-900">
                    {peso(booking.amount)}
                  </p>
                  {booking.status === "CONFIRMED" ? (
                    <div className="flex flex-wrap gap-2">
                      <Button
                        disabled={pending}
                        onClick={() => {
                          const reason = window.prompt("Reason for cancelling this session?");
                          if (!reason) return;
                          void call("Session cancelled.", () =>
                            apiFetch("/coaches/bookings/cancel-by-coach", {
                              method: "POST",
                              body: { bookingId: booking.id, reason },
                            }),
                          );
                        }}
                        size="sm"
                        variant="danger"
                      >
                        <Ban aria-hidden="true" size={16} /> Cancel session
                      </Button>
                    </div>
                  ) : null}
                  {booking.status === "PROOF_SUBMITTED" && booking.submission ? (
                    <div className="flex flex-wrap gap-2">
                      <Button
                        loading={pending}
                        onClick={() =>
                          call("Proof approved — session confirmed.", () =>
                            apiFetch("/coaches/bookings/proof/approve", {
                              method: "POST",
                              body: {
                                submissionId: booking.submission?.id,
                                bookingId: booking.id,
                              },
                            }),
                          )
                        }
                        size="sm"
                      >
                        <Check aria-hidden="true" size={16} /> Approve
                      </Button>
                      <Button
                        disabled={pending}
                        onClick={() => {
                          const reason = window.prompt("Reason for rejecting?");
                          if (!reason) return;
                          void call("Proof rejected.", () =>
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
                        size="sm"
                        variant="secondary"
                      >
                        <X aria-hidden="true" size={16} /> Reject
                      </Button>
                    </div>
                  ) : null}
                </Card>
              ))}
            </div>
          )}
        </>
      ) : null}
    </div>
  );
}

function AvailabilityList({ slots }: { slots: AvailabilitySlot[] }) {
  if (slots.length === 0) {
    return <p className="m-0 text-sm text-ink-500">No availability posted yet.</p>;
  }
  return (
    <ul className="m-0 flex list-none flex-col gap-2 p-0">
      {slots.map((slot) => (
        <li
          className="flex flex-wrap items-center gap-3 rounded-(--radius-control) border border-sand-200 bg-white px-4 py-2.5 text-sm"
          key={slot.id}
        >
          <span className="font-medium text-ink-900">{formatWhen(slot.startsAt)}</span>
          <span className="text-ink-500">{slot.location}</span>
        </li>
      ))}
    </ul>
  );
}
