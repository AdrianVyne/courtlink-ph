"use client";

import { useRouter } from "next/navigation";
import { type FormEvent, useState } from "react";
import { ApiError, apiFetch } from "../lib/api";
import { Button, Field, Input, Select, useToast } from "./ui";

type Scope = "courts" | "coaches";

export function ReviewForm({ scope, bookingId }: { scope: Scope; bookingId: string }) {
  const router = useRouter();
  const { push } = useToast();
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
      push("Review submitted.");
      router.refresh();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Could not submit your review.");
    } finally {
      setPending(false);
    }
  }

  if (done) {
    return (
      <p className="m-0 mt-2 rounded-(--radius-control) bg-success-bg px-3 py-2 text-sm text-success-fg">
        Thanks for your review.
      </p>
    );
  }

  return (
    <form className="mt-2 flex flex-wrap items-end gap-3" onSubmit={onSubmit}>
      <Field label="Rating">
        <Select onChange={(e) => setRating(Number(e.target.value))} value={rating}>
          {[5, 4, 3, 2, 1].map((value) => (
            <option key={value} value={value}>
              {value} star{value === 1 ? "" : "s"}
            </option>
          ))}
        </Select>
      </Field>
      <Field label="Comment (optional)">
        <Input maxLength={2000} name="comment" type="text" />
      </Field>
      {error ? (
        <p className="m-0 w-full text-sm text-danger-fg" role="alert">
          {error}
        </p>
      ) : null}
      <Button loading={pending} size="sm" type="submit">
        Submit review
      </Button>
    </form>
  );
}
