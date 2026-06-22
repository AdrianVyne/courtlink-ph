"use client";

import { useRouter } from "next/navigation";
import { type FormEvent, useState } from "react";
import { ApiError, apiFetch } from "../lib/api";

type Scope = "courts" | "coaches";

export function ReviewForm({ scope, bookingId }: { scope: Scope; bookingId: string }) {
  const router = useRouter();
  const [rating, setRating] = useState(5);
  const [done, setDone] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPending(true);
    setError(null);
    const comment = String(new FormData(event.currentTarget).get("comment") ?? "");
    try {
      await apiFetch(`/reviews/${scope}`, {
        method: "POST",
        body: { bookingId, rating, comment: comment || null },
      });
      setDone(true);
      router.refresh();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Could not submit your review.");
    } finally {
      setPending(false);
    }
  }

  if (done) {
    return <p className="court-success">Thanks for your review.</p>;
  }

  return (
    <form className="review-form" onSubmit={onSubmit}>
      <label className="field">
        <span className="field-label">Rating</span>
        <select value={rating} onChange={(e) => setRating(Number(e.target.value))}>
          {[5, 4, 3, 2, 1].map((value) => (
            <option key={value} value={value}>
              {value} star{value === 1 ? "" : "s"}
            </option>
          ))}
        </select>
      </label>
      <label className="field">
        <span className="field-label">Comment (optional)</span>
        <input name="comment" type="text" maxLength={2000} />
      </label>
      {error ? (
        <p className="form-error" role="alert">
          {error}
        </p>
      ) : null}
      <button className="button button-small" type="submit" disabled={pending}>
        Submit review
      </button>
    </form>
  );
}
