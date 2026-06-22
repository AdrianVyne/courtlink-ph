"use client";

import { useRouter } from "next/navigation";
import { type FormEvent, useState } from "react";
import { ApiError, type PlayerCoachRequest, apiFetch } from "../lib/api";

function formatWhen(iso: string): string {
  return new Date(iso).toLocaleString("en-PH", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: "Asia/Manila",
  });
}

export function PlayerCoaching({ requests }: { requests: PlayerCoachRequest[] }) {
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

  async function postRequest(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    await call(() =>
      apiFetch("/coaches/requests", {
        method: "POST",
        body: {
          startsAt: new Date(String(form.get("startsAt") ?? "")).toISOString(),
          endsAt: new Date(String(form.get("endsAt") ?? "")).toISOString(),
          location: String(form.get("location") ?? ""),
          groupSize: Number(form.get("groupSize") ?? 1),
          skillLevel: String(form.get("skillLevel") ?? "beginner"),
          goals: String(form.get("goals") ?? "") || null,
        },
      }),
    );
  }

  async function uploadProof(bookingId: string, event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const file = form.get("file");
    if (!(file instanceof File) || file.size === 0) {
      setError("Attach a screenshot of your payment.");
      return;
    }
    setPending(true);
    setError(null);
    try {
      const upload = new FormData();
      upload.set("channel", String(form.get("channel") ?? "GCASH"));
      upload.set("transactionRef", String(form.get("transactionRef") ?? ""));
      upload.set("file", file);
      const response = await fetch(`/api/v1/coaches/bookings/${bookingId}/proof-upload`, {
        method: "POST",
        body: upload,
        credentials: "include",
      });
      if (!response.ok) {
        const body = (await response.json().catch(() => ({}))) as { message?: string };
        throw new ApiError(response.status, "API_ERROR", body.message ?? "Upload failed");
      }
      router.refresh();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Upload failed.");
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="coach-workspace">
      {error ? (
        <p className="form-error" role="alert">
          {error}
        </p>
      ) : null}

      <h2 className="section-title">Post a coaching request</h2>
      <form className="row-form" onSubmit={postRequest}>
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
        <label className="field">
          <span className="field-label">Players</span>
          <input name="groupSize" type="number" min={1} max={64} defaultValue={2} required />
        </label>
        <label className="field">
          <span className="field-label">Skill level</span>
          <select name="skillLevel" defaultValue="beginner">
            <option value="beginner">Beginner</option>
            <option value="intermediate">Intermediate</option>
            <option value="advanced">Advanced</option>
          </select>
        </label>
        <button className="button button-small" type="submit" disabled={pending}>
          Post request
        </button>
      </form>

      <h2 className="section-title">Your coaching requests</h2>
      {requests.length === 0 ? (
        <p className="empty-state">You have not posted any coaching requests.</p>
      ) : (
        <div className="queue-list">
          {requests.map((request) => (
            <article className="queue-card" key={request.id}>
              <div className="queue-head">
                <strong>
                  {request.groupSize} players - {request.skillLevel}
                </strong>
                <span className={`status-pill status-${request.status.toLowerCase()}`}>
                  {request.status}
                </span>
              </div>
              <p className="queue-when">
                {formatWhen(request.startsAt)} at {request.location}
              </p>

              {request.status === "OPEN" && request.offers.length > 0 ? (
                <ul className="offer-list">
                  {request.offers
                    .filter((offer) => offer.status === "ACTIVE")
                    .map((offer) => (
                      <li className="offer-row" key={offer.id}>
                        <span>PHP {offer.amount.toFixed(2)}</span>
                        <span className="offer-expiry">expires {formatWhen(offer.expiresAt)}</span>
                        <button
                          className="button button-small"
                          type="button"
                          disabled={pending}
                          onClick={() =>
                            call(() =>
                              apiFetch("/coaches/offers/accept", {
                                method: "POST",
                                body: { offerId: offer.id },
                              }),
                            )
                          }
                        >
                          Accept
                        </button>
                      </li>
                    ))}
                </ul>
              ) : null}

              {request.booking && request.booking.status === "HELD" ? (
                <form
                  className="proof-form"
                  onSubmit={(e) => uploadProof(request.booking?.id ?? "", e)}
                >
                  <p className="court-note">Pay the coach, then upload your proof.</p>
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
                    <span className="field-label">Payment screenshot</span>
                    <input
                      name="file"
                      type="file"
                      accept="image/png,image/jpeg,image/webp"
                      required
                    />
                  </label>
                  <button className="button button-small" type="submit" disabled={pending}>
                    Submit proof
                  </button>
                </form>
              ) : null}

              {request.booking && request.booking.status !== "HELD" ? (
                <p className="court-note">Booking status: {request.booking.status}</p>
              ) : null}
            </article>
          ))}
        </div>
      )}
    </div>
  );
}
