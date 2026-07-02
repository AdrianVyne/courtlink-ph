"use client";

import { CalendarClock } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import {
  ApiError,
  type BookingRecord,
  type CourtAvailabilitySlot,
  type CourtSummary,
  apiFetch,
} from "../lib/api";
import { Badge, Button, Card, Countdown, Field, Input, Select, useToast } from "./ui";

type Channel = "GCASH" | "MAYA" | "QR_PH" | "BANK_TRANSFER" | "OTHER";

export function CourtBooking({
  court,
  isAuthenticated,
}: {
  court: CourtSummary;
  isAuthenticated: boolean;
}) {
  const { push } = useToast();
  const [date, setDate] = useState("");
  const [durationMin, setDurationMin] = useState(court.minimumDurationMin);
  const [slots, setSlots] = useState<CourtAvailabilitySlot[]>([]);
  const [selectedSlot, setSelectedSlot] = useState<CourtAvailabilitySlot | null>(null);
  const [loaded, setLoaded] = useState(false);
  const [booking, setBooking] = useState<BookingRecord | null>(null);
  const [confirmed, setConfirmed] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function loadAvailability() {
    if (!date) {
      setError("Pick a date first.");
      return;
    }
    setError(null);
    setPending(true);
    try {
      const result = await apiFetch<CourtAvailabilitySlot[]>(`/courts/${court.id}/availability`, {
        query: { date, durationMin },
      });
      setSlots(result);
      setSelectedSlot(null);
      setLoaded(true);
    } catch (err) {
      setError(err instanceof ApiError ? friendly(err) : "Could not load available times.");
      setSlots([]);
      setSelectedSlot(null);
      setLoaded(false);
    } finally {
      setPending(false);
    }
  }

  async function placeHold() {
    if (!selectedSlot) return;
    setError(null);
    setPending(true);
    try {
      const result = await apiFetch<BookingRecord>(`/courts/${court.id}/hold`, {
        method: "POST",
        body: { startsAt: selectedSlot.startsAt, endsAt: selectedSlot.endsAt },
      });
      setBooking(result);
      push("Slot held — submit your payment proof within 5 minutes.");
    } catch (err) {
      setError(err instanceof ApiError ? friendly(err) : "Could not hold this slot.");
    } finally {
      setPending(false);
    }
  }

  async function submitProof(form: FormData) {
    if (!booking) return;
    const file = form.get("file");
    if (!(file instanceof File) || file.size === 0) {
      setError("Attach a screenshot of your payment.");
      return;
    }
    setError(null);
    setPending(true);
    try {
      const upload = new FormData();
      upload.set("channel", String(form.get("channel") ?? "GCASH") as Channel);
      upload.set("transactionRef", String(form.get("transactionRef") ?? ""));
      upload.set("file", file);
      const response = await fetch(`/api/v1/courts/bookings/${booking.id}/proof-upload`, {
        method: "POST",
        body: upload,
        credentials: "include",
        headers: { "Idempotency-Key": crypto.randomUUID() },
      });
      if (!response.ok) {
        const body = (await response.json().catch(() => ({}))) as {
          code?: string;
          message?: string;
        };
        throw new ApiError(
          response.status,
          body.code ?? "API_ERROR",
          body.message ?? "Upload failed",
        );
      }
      setConfirmed(true);
      push("Proof submitted.");
    } catch (err) {
      setError(err instanceof ApiError ? friendly(err) : "Could not submit proof.");
    } finally {
      setPending(false);
    }
  }

  const durations = durationOptions(court);

  return (
    <Card className="flex flex-col gap-3 p-5">
      <div className="flex items-center justify-between gap-3">
        <h3 className="m-0 text-lg font-semibold text-ink-900">{court.name}</h3>
        <Badge>{court.indoor ? "Indoor" : "Outdoor"}</Badge>
      </div>
      {court.description ? (
        <p className="m-0 text-[0.9rem] text-ink-700">{court.description}</p>
      ) : null}

      {!isAuthenticated ? (
        <p className="m-0 text-sm text-ink-500">
          <Link className="font-semibold text-court-800 hover:underline" href="/login">
            Log in
          </Link>{" "}
          to check availability and book.
        </p>
      ) : confirmed ? (
        <p className="m-0 rounded-(--radius-control) bg-success-bg px-3 py-2.5 text-sm text-success-fg">
          Proof submitted. The venue will review and confirm your booking.
        </p>
      ) : booking ? (
        <form
          className="flex flex-col gap-3"
          action={(formData) => {
            void submitProof(formData);
          }}
        >
          <p className="m-0 rounded-(--radius-control) bg-pending-bg px-3 py-2.5 text-sm font-medium text-pending-fg">
            Slot held — proof due in <Countdown until={booking.proofDeadline} />. Pay the venue,
            then submit your reference.
          </p>
          <Field label="Channel">
            <Select defaultValue="GCASH" name="channel">
              <option value="GCASH">GCash</option>
              <option value="MAYA">Maya</option>
              <option value="QR_PH">QR Ph</option>
              <option value="BANK_TRANSFER">Bank transfer</option>
              <option value="OTHER">Other</option>
            </Select>
          </Field>
          <Field label="Reference number">
            <Input minLength={2} name="transactionRef" required type="text" />
          </Field>
          <Field label="Payment screenshot">
            <Input accept="image/png,image/jpeg,image/webp" name="file" required type="file" />
          </Field>
          <Button className="self-start" loading={pending} size="sm" type="submit">
            Submit proof
          </Button>
        </form>
      ) : (
        <div className="flex flex-col gap-3">
          <div className="flex flex-wrap gap-3">
            <Field label="Date">
              <Input
                onChange={(event) => {
                  setDate(event.target.value);
                  setSlots([]);
                  setSelectedSlot(null);
                  setLoaded(false);
                }}
                type="date"
                value={date}
              />
            </Field>
            <Field label="Duration">
              <Select
                onChange={(event) => {
                  setDurationMin(Number(event.target.value));
                  setSlots([]);
                  setSelectedSlot(null);
                  setLoaded(false);
                }}
                value={durationMin}
              >
                {durations.map((minutes) => (
                  <option key={minutes} value={minutes}>
                    {minutes} min
                  </option>
                ))}
              </Select>
            </Field>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button disabled={pending} onClick={loadAvailability} size="sm" variant="secondary">
              <CalendarClock aria-hidden="true" size={16} /> Load available times
            </Button>
            {selectedSlot ? (
              <Button loading={pending} onClick={placeHold} size="sm">
                Hold for {selectedSlot.currency} {selectedSlot.totalAmount.toFixed(2)}
              </Button>
            ) : null}
          </div>
          {slots.length > 0 ? (
            <fieldset className="m-0 grid grid-cols-[repeat(auto-fit,minmax(170px,1fr))] gap-2 border-0 p-0">
              <legend className="sr-only">Available times</legend>
              {slots.map((slot) => {
                const selected = selectedSlot?.startsAt === slot.startsAt;
                return (
                  <button
                    aria-pressed={selected}
                    className={`tnum cursor-pointer rounded-(--radius-control) border px-3 py-2.5 text-left text-sm transition-colors ${
                      selected
                        ? "border-court-700 bg-court-100 font-semibold text-court-800"
                        : "border-sand-200 bg-white text-ink-900 hover:border-court-400"
                    }`}
                    key={slot.startsAt}
                    onClick={() => setSelectedSlot(slot)}
                    type="button"
                  >
                    {formatSlot(slot)} · {slot.currency} {slot.totalAmount.toFixed(2)}
                  </button>
                );
              })}
            </fieldset>
          ) : loaded ? (
            <p className="m-0 text-sm text-ink-500">
              No available times for that date and duration.
            </p>
          ) : null}
        </div>
      )}

      {error ? (
        <p
          className="m-0 rounded-(--radius-control) border border-danger-fg/30 bg-danger-bg px-3 py-2.5 text-sm text-danger-fg"
          role="alert"
        >
          {error}
        </p>
      ) : null}
    </Card>
  );
}

function formatSlot(slot: CourtAvailabilitySlot): string {
  const format = (value: string) =>
    new Date(value).toLocaleTimeString("en-US", {
      hour: "numeric",
      minute: "2-digit",
      timeZone: "Asia/Manila",
    });
  return `${format(slot.startsAt)} – ${format(slot.endsAt)}`;
}

function durationOptions(court: CourtSummary): number[] {
  const options: number[] = [];
  for (
    let minutes = court.minimumDurationMin;
    minutes <= court.maximumDurationMin;
    minutes += court.slotIncrementMin
  ) {
    options.push(minutes);
  }
  return options.length > 0 ? options : [court.minimumDurationMin];
}

function friendly(error: ApiError): string {
  switch (error.code) {
    case "QUOTE_NO_PRICING_RULE":
      return "No price is set for that time. Try another slot.";
    case "QUOTE_DURATION_TOO_SHORT":
    case "QUOTE_DURATION_TOO_LONG":
    case "QUOTE_INVALID_INCREMENT":
      return "That duration is not available for this court.";
    case "PROOF_TYPE_UNSUPPORTED":
      return "Upload a JPEG, PNG, or WebP image.";
    case "PROOF_TOO_LARGE":
      return "That image is too large. Use one 5 MB or smaller.";
    case "HOLD_EXPIRED":
      return "Your 5-minute hold expired. Please book the slot again.";
    case "COURT_CLOSED":
    case "COURT_CLOSURE_CONFLICT":
    case "COURT_BOOKING_CONFLICT":
      return "That time is no longer available. Load the schedule again.";
    case "AUTH_REQUIRED":
      return "Please log in to continue.";
    default:
      return error.message;
  }
}
