"use client";

import { useRouter } from "next/navigation";
import { type FormEvent, useState } from "react";
import { type AmenityCatalogEntry, ApiError, apiFetch } from "../lib/api";

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
      <h3 className="workspace-title" id={`amenities-${venueId}`}>
        Amenities
      </h3>
      {error ? (
        <p className="form-error" role="alert">
          {error}
        </p>
      ) : null}
      <form className="amenity-editor" onSubmit={save}>
        <div className="amenity-options">
          {options.map((entry) => (
            <label key={entry.key} className="amenity-chip">
              <input
                type="checkbox"
                name="amenities"
                value={entry.key}
                defaultChecked={selected.includes(entry.key)}
              />
              <span>{entry.name}</span>
            </label>
          ))}
        </div>
        <div className="filter-actions">
          <button className="button button-small" type="submit" disabled={pending}>
            Save amenities
          </button>
          {saved ? <span className="amenity-saved">Saved</span> : null}
        </div>
      </form>
    </section>
  );
}
