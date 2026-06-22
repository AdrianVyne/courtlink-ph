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

const DAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

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
    <article className="schedule-manager">
      <div className="court-card-head">
        <h3>{court.name}</h3>
        <span className="court-tag">Asia/Manila</span>
      </div>
      {error ? (
        <p className="form-error" role="alert">
          {error}
        </p>
      ) : null}

      {canEdit ? (
        <form className="schedule-hours" onSubmit={saveHours}>
          {DAYS.map((day, dayOfWeek) => {
            const dayWindows = windows.filter((window) => window.dayOfWeek === dayOfWeek);
            return (
              <fieldset className="schedule-day" key={day}>
                <legend>{day}</legend>
                {dayWindows.length === 0 ? <span className="court-note">Closed</span> : null}
                {dayWindows.map((window, index) => {
                  const labelPrefix = dayWindows.length > 1 ? `${day} window ${index + 1}` : day;
                  return (
                    <div className="schedule-window" key={window.key}>
                      <label className="field">
                        <span className="field-label">{labelPrefix} opens</span>
                        <input
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
                      <label className="field">
                        <span className="field-label">{labelPrefix} closes</span>
                        <input
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
                        className="text-button"
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
                <button className="text-button" type="button" onClick={() => addWindow(dayOfWeek)}>
                  Add {day} window
                </button>
              </fieldset>
            );
          })}
          <button className="button button-small" type="submit" disabled={pending}>
            Save weekly hours
          </button>
        </form>
      ) : (
        <div className="schedule-readonly">
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

      <h4>Upcoming closures</h4>
      {canEdit ? (
        <form className="row-form" onSubmit={addClosure}>
          <label className="field">
            <span className="field-label">Closure starts</span>
            <input name="startsAt" type="datetime-local" required />
          </label>
          <label className="field">
            <span className="field-label">Closure ends</span>
            <input name="endsAt" type="datetime-local" required />
          </label>
          <label className="field">
            <span className="field-label">Closure reason</span>
            <input name="reason" type="text" maxLength={500} />
          </label>
          <button className="button button-small" type="submit" disabled={pending}>
            Add closure
          </button>
        </form>
      ) : null}
      {schedule.closures.length === 0 ? (
        <p className="empty-state">No upcoming closures.</p>
      ) : (
        <ul className="booking-list">
          {schedule.closures.map((closure: CourtClosure) => (
            <li className="booking-row" key={closure.id}>
              <div className="booking-main">
                <strong>{closure.reason || "Court closed"}</strong>
                <span className="booking-when">
                  {formatManila(closure.startsAt)} - {formatManila(closure.endsAt)}
                </span>
              </div>
              {canEdit ? (
                <button
                  className="text-button"
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
