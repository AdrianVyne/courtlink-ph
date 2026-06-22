"use client";

import { useRouter } from "next/navigation";
import { type FormEvent, useState } from "react";
import { ApiError, type Promotion, apiFetch } from "../lib/api";

function formatWhen(iso: string): string {
  return new Date(iso).toLocaleString("en-PH", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: "Asia/Manila",
  });
}

export function PromotionManager({
  venueId,
  promotions,
}: {
  venueId: string;
  promotions: Promotion[];
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

  async function create(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    await call(() =>
      apiFetch(`/promotions/venues/${venueId}`, {
        method: "POST",
        body: {
          title: String(form.get("title") ?? ""),
          description: String(form.get("description") ?? "") || null,
          startsAt: new Date(String(form.get("startsAt") ?? "")).toISOString(),
          endsAt: new Date(String(form.get("endsAt") ?? "")).toISOString(),
          discountType: String(form.get("discountType") ?? "PERCENT"),
          discountValue: Number(form.get("discountValue") ?? 0),
        },
      }),
    );
  }

  return (
    <div className="coach-workspace">
      <h2 className="section-title">Promotions</h2>
      {error ? (
        <p className="form-error" role="alert">
          {error}
        </p>
      ) : null}
      <form className="row-form" onSubmit={create}>
        <label className="field">
          <span className="field-label">Title</span>
          <input name="title" type="text" required minLength={2} />
        </label>
        <label className="field">
          <span className="field-label">Type</span>
          <select name="discountType" defaultValue="PERCENT">
            <option value="PERCENT">Percent</option>
            <option value="FIXED">Fixed PHP</option>
          </select>
        </label>
        <label className="field">
          <span className="field-label">Value</span>
          <input name="discountValue" type="number" min={1} step="0.01" required />
        </label>
        <label className="field">
          <span className="field-label">Starts</span>
          <input name="startsAt" type="datetime-local" required />
        </label>
        <label className="field">
          <span className="field-label">Ends</span>
          <input name="endsAt" type="datetime-local" required />
        </label>
        <button className="button button-small" type="submit" disabled={pending}>
          Add promotion
        </button>
      </form>

      {promotions.length === 0 ? (
        <p className="empty-state">No promotions yet.</p>
      ) : (
        <ul className="booking-list">
          {promotions.map((promotion) => (
            <li className="booking-row" key={promotion.id}>
              <div className="booking-main">
                <strong>{promotion.title}</strong>
                <span className="booking-venue">
                  {promotion.discountType === "PERCENT"
                    ? `${promotion.discountValue}% off`
                    : `PHP ${promotion.discountValue.toFixed(2)} off`}
                </span>
                <span className="booking-when">
                  {formatWhen(promotion.startsAt)} - {formatWhen(promotion.endsAt)}
                </span>
              </div>
              <div className="booking-meta">
                <span
                  className={`status-pill status-${promotion.active ? "confirmed" : "cancelled"}`}
                >
                  {promotion.active ? "Active" : "Inactive"}
                </span>
                {promotion.active ? (
                  <button
                    className="text-button"
                    type="button"
                    disabled={pending}
                    onClick={() =>
                      call(() =>
                        apiFetch(`/promotions/${promotion.id}/deactivate`, { method: "POST" }),
                      )
                    }
                  >
                    Deactivate
                  </button>
                ) : null}
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
