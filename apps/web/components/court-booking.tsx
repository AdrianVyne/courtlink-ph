"use client";

import { CalendarClock } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { ApiError, type BookingRecord, type CourtSummary, type Quote, apiFetch } from "../lib/api";

type Channel = "GCASH" | "MAYA" | "QR_PH" | "BANK_TRANSFER" | "OTHER";

interface ProofResult {
  booking: BookingRecord;
}

export function CourtBooking({
  court,
  isAuthenticated,
}: {
  court: CourtSummary;
  isAuthenticated: boolean;
}) {
  const [startsAt, setStartsAt] = useState("");
  const [durationMin, setDurationMin] = useState(court.minimumDurationMin);
  const [quote, setQuote] = useState<Quote | null>(null);
  const [booking, setBooking] = useState<BookingRecord | null>(null);
  const [confirmed, setConfirmed] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  function toRange(): { startIso: string; endIso: string } | null {
    if (!startsAt) return null;
    const start = new Date(startsAt);
    if (Number.isNaN(start.getTime())) return null;
    const end = new Date(start.getTime() + durationMin * 60 * 1000);
    return { startIso: start.toISOString(), endIso: end.toISOString() };
  }

  async function getQuote() {
    const range = toRange();
    if (!range) {
      setError("Pick a start time first.");
      return;
    }
    setError(null);
    setPending(true);
    try {
      const result = await apiFetch<Quote>(`/courts/${court.id}/quote`, {
        query: { startsAt: range.startIso, endsAt: range.endIso },
      });
      setQuote(result);
    } catch (err) {
      setError(err instanceof ApiError ? friendly(err) : "Could not price this slot.");
      setQuote(null);
    } finally {
      setPending(false);
    }
  }

  async function placeHold() {
    const range = toRange();
    if (!range) return;
    setError(null);
    setPending(true);
    try {
      const result = await apiFetch<BookingRecord>(`/courts/${court.id}/hold`, {
        method: "POST",
        body: { startsAt: range.startIso, endsAt: range.endIso },
      });
      setBooking(result);
    } catch (err) {
      setError(err instanceof ApiError ? friendly(err) : "Could not hold this slot.");
    } finally {
      setPending(false);
    }
  }

  async function submitProof(form: FormData) {
    if (!booking) return;
    setError(null);
    setPending(true);
    try {
      await apiFetch<ProofResult>("/courts/bookings/proof", {
        method: "POST",
        body: {
          bookingId: booking.id,
          channel: String(form.get("channel") ?? "GCASH") as Channel,
          transactionRef: String(form.get("transactionRef") ?? ""),
          proofObjectKey: String(form.get("proofObjectKey") ?? ""),
        },
      });
      setConfirmed(true);
    } catch (err) {
      setError(err instanceof ApiError ? friendly(err) : "Could not submit proof.");
    } finally {
      setPending(false);
    }
  }

  const durations = durationOptions(court);

  return (
    <article className="court-card">
      <div className="court-card-head">
        <h3>{court.name}</h3>
        <span className="court-tag">{court.indoor ? "Indoor" : "Outdoor"}</span>
      </div>
      {court.description ? <p className="court-desc">{court.description}</p> : null}

      {!isAuthenticated ? (
        <p className="court-note">
          <Link href="/login">Log in</Link> to check availability and book.
        </p>
      ) : confirmed ? (
        <p className="court-success">
          Proof submitted. The venue will review and confirm your booking.
        </p>
      ) : booking ? (
        <form
          className="proof-form"
          action={(formData) => {
            void submitProof(formData);
          }}
        >
          <p className="court-note">
            Slot held until {new Date(booking.proofDeadline).toLocaleTimeString()}. Pay the venue,
            then submit your reference.
          </p>
          <label className="field">
            <span className="field-label">Channel</span>
            <select name="channel" defaultValue="GCASH">
              <option value="GCASH">GCash</option>
              <option value="MAYA">Maya</option>
              <option value="QR_PH">QR Ph</option>
              <option value="BANK_TRANSFER">Bank transfer</option>
              <option value="OTHER">Other</option>
            </select>
          </label>
          <label className="field">
            <span className="field-label">Reference number</span>
            <input name="transactionRef" type="text" required minLength={2} />
          </label>
          <label className="field">
            <span className="field-label">Proof file key</span>
            <input
              name="proofObjectKey"
              type="text"
              required
              minLength={2}
              placeholder="proofs/your-receipt.jpg"
            />
          </label>
          <button className="button button-small" type="submit" disabled={pending}>
            Submit proof
          </button>
        </form>
      ) : (
        <div className="booking-controls">
          <label className="field">
            <span className="field-label">Start</span>
            <input
              type="datetime-local"
              value={startsAt}
              onChange={(event) => {
                setStartsAt(event.target.value);
                setQuote(null);
              }}
            />
          </label>
          <label className="field">
            <span className="field-label">Duration</span>
            <select
              value={durationMin}
              onChange={(event) => {
                setDurationMin(Number(event.target.value));
                setQuote(null);
              }}
            >
              {durations.map((minutes) => (
                <option key={minutes} value={minutes}>
                  {minutes} min
                </option>
              ))}
            </select>
          </label>
          <div className="booking-actions">
            <button
              className="button button-secondary button-small"
              type="button"
              onClick={getQuote}
              disabled={pending}
            >
              <CalendarClock size={16} aria-hidden="true" /> Get price
            </button>
            {quote ? (
              <button
                className="button button-small"
                type="button"
                onClick={placeHold}
                disabled={pending}
              >
                Hold for {quote.currency} {quote.totalAmount.toFixed(2)}
              </button>
            ) : null}
          </div>
        </div>
      )}

      {error ? (
        <p className="form-error" role="alert">
          {error}
        </p>
      ) : null}
    </article>
  );
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
    case "AUTH_REQUIRED":
      return "Please log in to continue.";
    default:
      return error.message;
  }
}
