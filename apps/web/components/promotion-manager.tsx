"use client";

import { useRouter } from "next/navigation";
import { type FormEvent, useState } from "react";
import { ApiError, type Promotion, apiFetch } from "../lib/api";
import { Button, Field, Input, Select } from "./ui";

function byStartsAtDesc(a: Promotion, b: Promotion): number {
  return new Date(b.startsAt).getTime() - new Date(a.startsAt).getTime();
}

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
  const [items, setItems] = useState(() => [...promotions].sort(byStartsAtDesc));

  async function call<T>(action: () => Promise<T>, onSuccess?: (result: T) => void) {
    setPending(true);
    setError(null);
    try {
      const result = await action();
      onSuccess?.(result);
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
    await call(
      () =>
        apiFetch<Promotion>(`/promotions/venues/${venueId}`, {
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
      (created) => setItems((current) => [created, ...current].sort(byStartsAtDesc)),
    );
  }

  return (
    <div className="flex flex-col">
      <h2 className="mb-4 mt-8 text-[1.15rem] font-bold text-ink-900">Promotions</h2>
      {error ? (
        <p
          className="m-0 rounded-[10px] border border-[#f1b5b0] bg-danger-bg px-[0.8rem] py-[0.6rem] text-[0.88rem] text-danger-fg"
          role="alert"
        >
          {error}
        </p>
      ) : null}
      <form className="mt-2 flex flex-wrap items-end gap-3" onSubmit={create}>
        <Field label="Title">
          <Input name="title" type="text" required minLength={2} />
        </Field>
        <Field label="Type">
          <Select name="discountType" defaultValue="PERCENT">
            <option value="PERCENT">Percent</option>
            <option value="FIXED">Fixed PHP</option>
          </Select>
        </Field>
        <Field label="Value">
          <Input name="discountValue" type="number" min={1} step="0.01" required />
        </Field>
        <Field label="Starts">
          <Input name="startsAt" type="datetime-local" required />
        </Field>
        <Field label="Ends">
          <Input name="endsAt" type="datetime-local" required />
        </Field>
        <Button size="sm" type="submit" disabled={pending}>
          Add promotion
        </Button>
      </form>

      {items.length === 0 ? (
        <p className="py-8 text-ink-500">No promotions yet.</p>
      ) : (
        <ul className="m-0 mt-4 flex list-none flex-col gap-[0.6rem] p-0">
          {items.map((promotion) => (
            <li
              className="flex flex-wrap items-center justify-between gap-3 rounded-[10px] border border-sand-200 bg-white px-4 py-[0.85rem]"
              key={promotion.id}
            >
              <div className="flex flex-col gap-[0.15rem]">
                <strong>{promotion.title}</strong>
                <span className="text-[0.85rem] text-ink-500">
                  {promotion.discountType === "PERCENT"
                    ? `${promotion.discountValue}% off`
                    : `PHP ${promotion.discountValue.toFixed(2)} off`}
                </span>
                <span className="text-[0.85rem]">
                  {formatWhen(promotion.startsAt)} - {formatWhen(promotion.endsAt)}
                </span>
              </div>
              <div className="flex flex-col items-end gap-[0.35rem]">
                <span
                  className={`inline-flex items-center rounded-full px-2.5 py-1 text-xs font-bold uppercase tracking-wide ${
                    promotion.active
                      ? "bg-success-bg text-success-fg"
                      : "bg-danger-bg text-danger-fg"
                  }`}
                  data-tone={promotion.active ? "success" : "danger"}
                >
                  {promotion.active ? "Active" : "Inactive"}
                </span>
                {promotion.active ? (
                  <button
                    className="cursor-pointer text-[0.9rem] font-semibold text-ink-700"
                    type="button"
                    disabled={pending}
                    onClick={() =>
                      call(
                        () =>
                          apiFetch<Promotion>(`/promotions/${promotion.id}/deactivate`, {
                            method: "POST",
                          }),
                        (updated) =>
                          setItems((current) =>
                            current.map((item) => (item.id === updated.id ? updated : item)),
                          ),
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
