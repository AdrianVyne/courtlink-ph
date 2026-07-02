"use client";

import { SlidersHorizontal, X } from "lucide-react";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { Button } from "../ui";

export interface DiscoveryFilterParams {
  q?: string | undefined;
  city?: string | undefined;
  date?: string | undefined;
  durationMin?: string | undefined;
  maxPrice?: string | undefined;
  amenities?: string | undefined;
}

export interface AmenityOption {
  key: string;
  name: string;
}

/** Builds a /courts href with one filter (or one amenity value) removed. */
export function buildFilterHref(
  params: DiscoveryFilterParams,
  remove: { key: keyof DiscoveryFilterParams; value?: string },
): string {
  const next: Record<string, string> = {};
  for (const [key, value] of Object.entries(params)) {
    if (value) next[key] = value;
  }
  if (remove.key === "amenities" && remove.value) {
    const remaining = (next.amenities ?? "")
      .split(",")
      .filter(Boolean)
      .filter((entry) => entry !== remove.value);
    if (remaining.length > 0) next.amenities = remaining.join(",");
    else delete next.amenities;
  } else {
    delete next[remove.key];
    if (remove.key === "date") delete next.durationMin;
  }
  const query = new URLSearchParams(next).toString();
  return query ? `/courts?${query}` : "/courts";
}

const durationLabels: Record<string, string> = {
  "60": "1 hour",
  "90": "1.5 hours",
  "120": "2 hours",
  "180": "3 hours",
};

interface Chip {
  label: string;
  href: string;
}

function activeChips(params: DiscoveryFilterParams, catalog: AmenityOption[]): Chip[] {
  const chips: Chip[] = [];
  if (params.q) chips.push({ label: `“${params.q}”`, href: buildFilterHref(params, { key: "q" }) });
  if (params.city)
    chips.push({ label: params.city, href: buildFilterHref(params, { key: "city" }) });
  if (params.date) {
    const duration = durationLabels[params.durationMin ?? "60"] ?? "1 hour";
    chips.push({
      label: `${params.date} · ${duration}`,
      href: buildFilterHref(params, { key: "date" }),
    });
  }
  if (params.maxPrice) {
    chips.push({
      label: `≤ ₱${params.maxPrice}/hr`,
      href: buildFilterHref(params, { key: "maxPrice" }),
    });
  }
  for (const key of (params.amenities ?? "").split(",").filter(Boolean)) {
    chips.push({
      label: catalog.find((entry) => entry.key === key)?.name ?? key,
      href: buildFilterHref(params, { key: "amenities", value: key }),
    });
  }
  return chips;
}

function FilterFields({
  params,
  amenityCatalog,
  idPrefix,
}: {
  params: DiscoveryFilterParams;
  amenityCatalog: AmenityOption[];
  idPrefix: string;
}) {
  const selected = new Set((params.amenities ?? "").split(",").filter(Boolean));
  const field =
    "min-h-11 w-full rounded-(--radius-control) border border-sand-200 bg-white px-3 text-ink-900 focus:border-court-700 focus:outline-2 focus:outline-court-700/30";
  return (
    <>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
        <label className="flex flex-col gap-1.5">
          <span className="text-xs font-semibold text-ink-500">Venue name</span>
          <input className={field} defaultValue={params.q ?? ""} name="q" type="search" />
        </label>
        <label className="flex flex-col gap-1.5">
          <span className="text-xs font-semibold text-ink-500">City or municipality</span>
          <input
            className={field}
            defaultValue={params.city ?? ""}
            name="city"
            placeholder="e.g. Cebu City"
            type="text"
          />
        </label>
        <label className="flex flex-col gap-1.5">
          <span className="text-xs font-semibold text-ink-500">Date</span>
          <input className={field} defaultValue={params.date ?? ""} name="date" type="date" />
        </label>
        <label className="flex flex-col gap-1.5">
          <span className="text-xs font-semibold text-ink-500">Duration</span>
          <select className={field} defaultValue={params.durationMin ?? "60"} name="durationMin">
            {Object.entries(durationLabels).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>
        </label>
        <label className="flex flex-col gap-1.5">
          <span className="text-xs font-semibold text-ink-500">Max price / hour</span>
          <input
            className={field}
            defaultValue={params.maxPrice ?? ""}
            min="0"
            name="maxPrice"
            placeholder="Any"
            step="50"
            type="number"
          />
        </label>
      </div>
      {amenityCatalog.length > 0 ? (
        <fieldset className="m-0 border-0 p-0">
          <legend className="mb-2 p-0 text-xs font-semibold text-ink-500">Amenities</legend>
          <div className="flex flex-wrap gap-2">
            {amenityCatalog.map((entry) => (
              <label
                className="inline-flex cursor-pointer items-center gap-1.5 rounded-full border border-sand-200 bg-sand-100 px-3 py-1.5 text-sm text-ink-700 has-checked:border-court-700 has-checked:bg-court-100 has-checked:text-court-800"
                key={`${idPrefix}-${entry.key}`}
              >
                <input
                  className="accent-court-700"
                  defaultChecked={selected.has(entry.key)}
                  name="amenities"
                  type="checkbox"
                  value={entry.key}
                />
                {entry.name}
              </label>
            ))}
          </div>
        </fieldset>
      ) : null}
      <div className="flex gap-2">
        <Button size="sm" type="submit">
          Apply filters
        </Button>
        <Button href="/courts" size="sm" variant="ghost">
          Reset
        </Button>
      </div>
    </>
  );
}

export function FilterBar({
  params,
  amenityCatalog,
  resultCount,
}: {
  params: DiscoveryFilterParams;
  amenityCatalog: AmenityOption[];
  resultCount: number;
}) {
  const chips = activeChips(params, amenityCatalog);
  const dialogRef = useRef<HTMLDialogElement>(null);
  const [sheetOpen, setSheetOpen] = useState(false);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    const onClose = () => setSheetOpen(false);
    dialog.addEventListener("close", onClose);
    return () => dialog.removeEventListener("close", onClose);
  }, []);

  return (
    <section aria-label="Search filters" className="mb-6 flex flex-col gap-4">
      {/* Desktop: inline form. Mobile: button opening a sheet. */}
      <form
        action="/courts"
        className="hidden flex-col gap-4 rounded-(--radius-card) border border-sand-200 bg-white p-4 md:flex"
        method="get"
      >
        <FilterFields amenityCatalog={amenityCatalog} idPrefix="desktop" params={params} />
      </form>

      <div className="md:hidden">
        <button
          aria-expanded={sheetOpen}
          className="inline-flex min-h-11 items-center gap-2 rounded-(--radius-control) border border-sand-200 bg-white px-4 font-semibold text-ink-700"
          onClick={() => {
            dialogRef.current?.showModal();
            setSheetOpen(true);
          }}
          type="button"
        >
          <SlidersHorizontal aria-hidden="true" size={17} />
          Filters
          {chips.length > 0 ? (
            <span className="inline-flex size-5 items-center justify-center rounded-full bg-court-700 text-xs font-bold text-white">
              {chips.length}
            </span>
          ) : null}
        </button>
        <dialog
          aria-label="Search filters"
          className="m-0 mt-auto max-h-[85vh] w-full max-w-none overflow-y-auto rounded-t-2xl bg-white p-0 backdrop:bg-court-950/40"
          ref={dialogRef}
        >
          <form action="/courts" className="flex flex-col gap-4 p-5" method="get">
            <div className="flex items-center justify-between">
              <span className="font-display text-lg font-bold text-ink-900">Filters</span>
              <button
                className="inline-flex size-10 items-center justify-center rounded-(--radius-control) border border-sand-200 text-ink-700"
                onClick={() => dialogRef.current?.close()}
                type="button"
              >
                <X aria-hidden="true" size={18} />
                <span className="sr-only">Close filters</span>
              </button>
            </div>
            <FilterFields amenityCatalog={amenityCatalog} idPrefix="sheet" params={params} />
          </form>
        </dialog>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <p className="tnum m-0 mr-2 text-sm font-semibold text-ink-700">
          {resultCount} {resultCount === 1 ? "venue" : "venues"}
        </p>
        {chips.map((chip) => (
          <Link
            aria-label={`Remove filter: ${chip.label}`}
            className="inline-flex items-center gap-1.5 rounded-full border border-court-200 bg-court-100 px-3 py-1 text-sm font-semibold text-court-800 hover:border-court-700"
            href={chip.href}
            key={chip.href + chip.label}
          >
            {chip.label}
            <X aria-hidden="true" size={13} />
          </Link>
        ))}
      </div>
    </section>
  );
}
