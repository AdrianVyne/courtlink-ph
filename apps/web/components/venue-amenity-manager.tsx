"use client";

import { useRouter } from "next/navigation";
import { type FormEvent, useState } from "react";
import { type AmenityCatalogEntry, ApiError, apiFetch } from "../lib/api";
import { Button } from "./ui";

export function VenueAmenityManager({
  venueId,
  catalog,
  selected,
}: {
  venueId: string;
  catalog: AmenityCatalogEntry[];
  selected: string[];
}) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const [pending, setPending] = useState(false);
  const options = catalog.filter((entry) => entry.scope !== "COURT");

  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const amenities = form.getAll("amenities").map((value) => String(value));
    setPending(true);
    setError(null);
    setSaved(false);
    try {
      await apiFetch(`/venues/${venueId}/amenities`, {
        method: "PUT",
        body: { amenities },
      });
      setSaved(true);
      router.refresh();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Could not save amenities.");
    } finally {
      setPending(false);
    }
  }

  return (
    <section aria-labelledby={`amenities-${venueId}`}>
      <h3 className="m-0 mb-4 text-base font-bold text-ink-900" id={`amenities-${venueId}`}>
        Amenities
      </h3>
      {error ? (
        <p
          className="m-0 rounded-[10px] border border-[#f1b5b0] bg-danger-bg px-[0.8rem] py-[0.6rem] text-[0.88rem] text-danger-fg"
          role="alert"
        >
          {error}
        </p>
      ) : null}
      <form className="mb-6 mt-2 flex flex-col gap-[0.8rem]" onSubmit={save}>
        <div className="flex flex-wrap gap-2">
          {options.map((entry) => (
            <label
              key={entry.key}
              className="inline-flex cursor-pointer items-center gap-[0.4rem] rounded-full border border-sand-200 bg-sand-50 px-[0.7rem] py-[0.35rem] text-[0.85rem]"
            >
              <input
                className="accent-court-700"
                type="checkbox"
                name="amenities"
                value={entry.key}
                defaultChecked={selected.includes(entry.key)}
              />
              <span>{entry.name}</span>
            </label>
          ))}
        </div>
        <div className="flex gap-[0.6rem]">
          <Button size="sm" type="submit" disabled={pending}>
            Save amenities
          </Button>
          {saved ? <span className="self-center text-[0.85rem] text-court-800">Saved</span> : null}
        </div>
      </form>
    </section>
  );
}
