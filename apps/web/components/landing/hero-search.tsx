"use client";

import { Search } from "lucide-react";
import { useRouter } from "next/navigation";
import type { FormEvent } from "react";
import { Button } from "../ui";

const durations = [
  { value: "60", label: "1 hour" },
  { value: "90", label: "1.5 hours" },
  { value: "120", label: "2 hours" },
];

/**
 * Uncontrolled on purpose: values are read from the form at submit, and the
 * native action="/courts" GET works even before hydration (or without JS).
 */
export function HeroSearch() {
  const router = useRouter();

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    const city = String(data.get("city") ?? "").trim();
    const date = String(data.get("date") ?? "");
    const durationMin = String(data.get("durationMin") ?? "60");
    const params = new URLSearchParams();
    if (city) params.set("city", city);
    if (date) {
      params.set("date", date);
      params.set("durationMin", durationMin);
    }
    const query = params.toString();
    router.push(query ? `/courts?${query}` : "/courts");
  }

  return (
    <form
      action="/courts"
      aria-label="Search courts"
      className="mx-auto mt-14 grid w-full max-w-3xl gap-3 rounded-2xl border border-sand-200 bg-white/95 p-4 text-left shadow-(--shadow-float) sm:grid-cols-[1.2fr_1fr_1fr_auto] sm:items-end"
      method="get"
      onSubmit={submit}
    >
      <label className="flex flex-col gap-1.5">
        <span className="text-xs font-bold uppercase tracking-widest text-ink-500">City</span>
        <input
          className="min-h-11 rounded-(--radius-control) border border-sand-200 bg-white px-3.5 text-ink-900 focus:border-court-700 focus:outline-2 focus:outline-court-700/30"
          name="city"
          placeholder="e.g. Cebu City"
          type="text"
        />
      </label>
      <label className="flex flex-col gap-1.5">
        <span className="text-xs font-bold uppercase tracking-widest text-ink-500">Date</span>
        <input
          className="min-h-11 rounded-(--radius-control) border border-sand-200 bg-white px-3.5 text-ink-900 focus:border-court-700 focus:outline-2 focus:outline-court-700/30"
          name="date"
          type="date"
        />
      </label>
      <label className="flex flex-col gap-1.5">
        <span className="text-xs font-bold uppercase tracking-widest text-ink-500">Duration</span>
        <select
          className="min-h-11 rounded-(--radius-control) border border-sand-200 bg-white px-3 text-ink-900 focus:border-court-700 focus:outline-2 focus:outline-court-700/30"
          defaultValue="60"
          name="durationMin"
        >
          {durations.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
      </label>
      <Button type="submit">
        <Search aria-hidden="true" size={17} /> Search courts
      </Button>
    </form>
  );
}
