"use client";

import { useRouter } from "next/navigation";
import { type FormEvent, useState } from "react";
import {
  ApiError,
  type CourtClosure,
  type CourtOperatingWindow,
  type CourtSchedule,
  type CourtSummary,
  apiFetch,
} from "../lib/api";
import { Button } from "./ui";

const DAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

const fieldClasses = "flex min-w-[135px] flex-col gap-[0.35rem]";
const labelClasses = "text-[0.72rem] font-bold uppercase tracking-[0.08em] text-ink-500";
const inputClasses =
  "min-h-[46px] rounded-[10px] border border-sand-200 bg-white px-[0.85rem] text-ink-900 " +
  "focus:border-court-700 focus:outline-2 focus:outline-court-700/30 focus:outline-offset-1";
const textButtonClasses = "w-fit cursor-pointer text-[0.9rem] font-semibold text-ink-700";

interface EditableWindow {
  key: string;
  dayOfWeek: number;
  opens: string;
  closes: string;
}

function minuteToInput(value: number): string {
  return `${String(Math.floor(value / 60)).padStart(2, "0")}:${String(value % 60).padStart(2, "0")}`;
}

export function timeInputToMinute(value: string): number {
  const match = /^(\d{2}):(\d{2})$/.exec(value);
  const hours = Number(match?.[1] ?? -1);
  const minutes = Number(match?.[2] ?? -1);
  if (
    !match ||
    hours < 0 ||
    hours > 24 ||
    minutes < 0 ||
    minutes > 59 ||
    (hours === 24 && minutes !== 0)
  ) {
    throw new Error("Enter time as HH:mm.");
  }
  return hours * 60 + minutes;
}

function formatMinute(value: number): string {
  const hour = Math.floor(value / 60);
  const minute = value % 60;
  const displayHour = hour % 12 || 12;
  return `${displayHour}:${String(minute).padStart(2, "0")} ${hour < 12 ? "AM" : "PM"}`;
}

function formatManila(iso: string): string {
  return new Date(iso).toLocaleString("en-PH", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: "Asia/Manila",
  });
}

export function manilaLocalToIso(value: string): string {
  if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(value)) {
    throw new Error("Enter a valid Manila date and time.");
  }
  const parsed = new Date(`${value}:00+08:00`);
  if (Number.isNaN(parsed.getTime())) throw new Error("Enter a valid Manila date and time.");
  return parsed.toISOString();
}

function editableWindows(windows: CourtOperatingWindow[]): EditableWindow[] {
  return windows.map((window) => ({
    key: window.id,
    dayOfWeek: window.dayOfWeek,
    opens: minuteToInput(window.opensMinute),
    closes: minuteToInput(window.closesMinute),
  }));
}

export function CourtScheduleManager({
  court,
  schedule,
  canEdit,
}: {
  court: CourtSummary;
  schedule: CourtSchedule;
  canEdit: boolean;
}) {
  const router = useRouter();
  const [windows, setWindows] = useState(() => editableWindows(schedule.operatingHours));
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function call(action: () => Promise<unknown>) {
    setPending(true);
    setError(null);
    try {
      await action();
      router.refresh();
    } catch (caught) {
      setError(
        caught instanceof ApiError || caught instanceof Error ? caught.message : "Action failed.",
      );
    } finally {
      setPending(false);
    }
  }

  function updateWindow(key: string, field: "opens" | "closes", value: string) {
    setWindows((current) =>
      current.map((window) => (window.key === key ? { ...window, [field]: value } : window)),
    );
  }

  function addWindow(dayOfWeek: number) {
    setWindows((current) => [
      ...current,
      { key: `new-${dayOfWeek}-${current.length}`, dayOfWeek, opens: "08:00", closes: "22:00" },
    ]);
  }

  async function saveHours(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    await call(() =>
      apiFetch(`/courts/${court.id}/operating-hours`, {
        method: "PUT",
        body: {
          windows: windows.map((window) => ({
            dayOfWeek: window.dayOfWeek,
            opensMinute: timeInputToMinute(window.opens),
            closesMinute: timeInputToMinute(window.closes),
          })),
        },
      }),
    );
  }

  async function addClosure(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    await call(() =>
      apiFetch(`/courts/${court.id}/closures`, {
        method: "POST",
        body: {
          startsAt: manilaLocalToIso(String(form.get("startsAt") ?? "")),
          endsAt: manilaLocalToIso(String(form.get("endsAt") ?? "")),
          reason: String(form.get("reason") ?? "") || null,
        },
      }),
    );
  }

  return (
    <article className="rounded-[12px] border border-sand-200 bg-white p-5">
      <div className="flex items-center justify-between">
        <h3 className="m-0 text-[1.1rem]">{court.name}</h3>
        <span className="rounded-full bg-sand-50 px-[0.6rem] py-1 text-[0.74rem] font-bold uppercase text-ink-500">
          Asia/Manila
        </span>
      </div>
      {error ? (
        <p
          className="m-0 mt-3 rounded-[10px] border border-[#f1b5b0] bg-danger-bg px-[0.8rem] py-[0.6rem] text-[0.88rem] text-danger-fg"
          role="alert"
        >
          {error}
        </p>
      ) : null}

      {canEdit ? (
        <form className="mt-4 grid gap-[0.65rem]" onSubmit={saveHours}>
          {DAYS.map((day, dayOfWeek) => {
            const dayWindows = windows.filter((window) => window.dayOfWeek === dayOfWeek);
            return (
              <fieldset
                className="m-0 grid gap-2 border-0 border-b border-sand-200 p-0 pb-3 pt-2"
                key={day}
              >
                <legend className="p-0 text-[0.85rem] font-bold">{day}</legend>
                {dayWindows.length === 0 ? (
                  <span className="text-[0.88rem] text-ink-500">Closed</span>
                ) : null}
                {dayWindows.map((window, index) => {
                  const labelPrefix = dayWindows.length > 1 ? `${day} window ${index + 1}` : day;
                  return (
                    <div className="flex flex-wrap items-end gap-2" key={window.key}>
                      <label className={fieldClasses}>
                        <span className={labelClasses}>{labelPrefix} opens</span>
                        <input
                          className={inputClasses}
                          aria-label={`${labelPrefix} opens`}
                          inputMode="numeric"
                          pattern="(?:[01]\d|2[0-3]):[0-5]\d"
                          placeholder="HH:mm"
                          title="Use 24-hour time as HH:mm"
                          type="text"
                          value={window.opens}
                          onChange={(event) =>
                            updateWindow(window.key, "opens", event.target.value)
                          }
                          required
                        />
                      </label>
                      <label className={fieldClasses}>
                        <span className={labelClasses}>{labelPrefix} closes</span>
                        <input
                          className={inputClasses}
                          aria-label={`${labelPrefix} closes`}
                          inputMode="numeric"
                          pattern="(?:(?:[01]\d|2[0-3]):[0-5]\d|24:00)"
                          placeholder="HH:mm"
                          title="Use 24-hour time as HH:mm; 24:00 means end of day"
                          type="text"
                          value={window.closes}
                          onChange={(event) =>
                            updateWindow(window.key, "closes", event.target.value)
                          }
                          required
                        />
                      </label>
                      <button
                        className={textButtonClasses}
                        type="button"
                        onClick={() =>
                          setWindows((current) => current.filter((item) => item.key !== window.key))
                        }
                      >
                        Remove
                      </button>
                    </div>
                  );
                })}
                <button
                  className={textButtonClasses}
                  type="button"
                  onClick={() => addWindow(dayOfWeek)}
                >
                  Add {day} window
                </button>
              </fieldset>
            );
          })}
          <Button className="w-fit" size="sm" type="submit" disabled={pending}>
            Save weekly hours
          </Button>
        </form>
      ) : (
        <div className="mt-4 grid gap-1 [&_p]:m-0 [&_p]:text-[0.88rem] [&_p]:text-ink-500">
          {DAYS.map((day, dayOfWeek) => {
            const dayWindows = schedule.operatingHours.filter(
              (window) => window.dayOfWeek === dayOfWeek,
            );
            return (
              <p key={day}>
                {day}:{" "}
                {dayWindows.length === 0
                  ? "Closed"
                  : dayWindows
                      .map(
                        (window) =>
                          `${formatMinute(window.opensMinute)}–${formatMinute(window.closesMinute)}`,
                      )
                      .join(", ")}
              </p>
            );
          })}
        </div>
      )}

      <h4 className="mb-3 mt-6">Upcoming closures</h4>
      {canEdit ? (
        <form className="mt-2 flex flex-wrap items-end gap-3" onSubmit={addClosure}>
          <label className={fieldClasses}>
            <span className={labelClasses}>Closure starts</span>
            <input className={inputClasses} name="startsAt" type="datetime-local" required />
          </label>
          <label className={fieldClasses}>
            <span className={labelClasses}>Closure ends</span>
            <input className={inputClasses} name="endsAt" type="datetime-local" required />
          </label>
          <label className={fieldClasses}>
            <span className={labelClasses}>Closure reason</span>
            <input className={inputClasses} name="reason" type="text" maxLength={500} />
          </label>
          <Button size="sm" type="submit" disabled={pending}>
            Add closure
          </Button>
        </form>
      ) : null}
      {schedule.closures.length === 0 ? (
        <p className="py-8 text-ink-500">No upcoming closures.</p>
      ) : (
        <ul className="m-0 mt-3 flex list-none flex-col gap-[0.6rem] p-0">
          {schedule.closures.map((closure: CourtClosure) => (
            <li
              className="flex flex-wrap items-center justify-between gap-3 rounded-[10px] border border-sand-200 bg-white px-4 py-[0.85rem]"
              key={closure.id}
            >
              <div className="flex flex-col gap-[0.15rem]">
                <strong>{closure.reason || "Court closed"}</strong>
                <span className="text-[0.85rem]">
                  {formatManila(closure.startsAt)} - {formatManila(closure.endsAt)}
                </span>
              </div>
              {canEdit ? (
                <button
                  className={textButtonClasses}
                  type="button"
                  disabled={pending}
                  onClick={() =>
                    call(() =>
                      apiFetch(`/courts/${court.id}/closures/${closure.id}`, {
                        method: "DELETE",
                      }),
                    )
                  }
                >
                  Delete closure
                </button>
              ) : null}
            </li>
          ))}
        </ul>
      )}
    </article>
  );
}
