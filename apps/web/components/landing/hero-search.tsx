"use client";

import { Search } from "lucide-react";
import { useRouter } from "next/navigation";
import { type FormEvent, useState } from "react";
import { Button } from "../ui";

const durations = [
  { value: "60", label: "1 hour" },
  { value: "90", label: "1.5 hours" },
  { value: "120", label: "2 hours" },
];

export function HeroSearch() {
  const router = useRouter();
  const [city, setCity] = useState("");
  const [date, setDate] = useState("");
  const [durationMin, setDurationMin] = useState("60");

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const params = new URLSearchParams();
    if (city.trim()) params.set("city", city.trim());
    if (date) {
      params.set("date", date);
      params.set("durationMin", durationMin);
    }
    const query = params.toString();
    router.push(query ? `/courts?${query}` : "/courts");
  }

  return (
    <form
      aria-label="Search courts"
      className="mx-auto mt-14 grid w-full max-w-3xl gap-3 rounded-2xl border border-sand-200 bg-white/95 p-4 text-left shadow-(--shadow-float) sm:grid-cols-[1.2fr_1fr_1fr_auto] sm:items-end"
      onSubmit={submit}
    >
      <label className="flex flex-col gap-1.5">
        <span className="text-xs font-bold uppercase tracking-widest text-ink-500">City</span>
        <input
          className="min-h-11 rounded-(--radius-control) border border-sand-200 bg-white px-3.5 text-ink-900 focus:border-court-700 focus:outline-2 focus:outline-court-700/30"
          name="city"
          onChange={(event) => setCity(event.target.value)}
          placeholder="e.g. Cebu City"
          type="text"
          value={city}
        />
      </label>
      <label className="flex flex-col gap-1.5">
        <span className="text-xs font-bold uppercase tracking-widest text-ink-500">Date</span>
        <input
          className="min-h-11 rounded-(--radius-control) border border-sand-200 bg-white px-3.5 text-ink-900 focus:border-court-700 focus:outline-2 focus:outline-court-700/30"
          name="date"
          onChange={(event) => setDate(event.target.value)}
          type="date"
          value={date}
        />
      </label>
      <label className="flex flex-col gap-1.5">
        <span className="text-xs font-bold uppercase tracking-widest text-ink-500">Duration</span>
        <select
          className="min-h-11 rounded-(--radius-control) border border-sand-200 bg-white px-3 text-ink-900 focus:border-court-700 focus:outline-2 focus:outline-court-700/30"
          name="durationMin"
          onChange={(event) => setDurationMin(event.target.value)}
          value={durationMin}
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
