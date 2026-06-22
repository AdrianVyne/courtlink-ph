import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { type CourtSummary, apiFetch } from "../lib/api";
import { CourtScheduleManager, timeInputToMinute } from "./court-schedule-manager";

vi.mock("../lib/api", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../lib/api")>();
  return { ...actual, apiFetch: vi.fn() };
});

const refresh = vi.fn();
vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh }) }));

const court: CourtSummary = {
  id: "court-1",
  venueId: "venue-1",
  name: "Center Court",
  description: null,
  indoor: true,
  active: true,
  slotIncrementMin: 30,
  minimumDurationMin: 60,
  maximumDurationMin: 120,
};

const schedule = {
  operatingHours: [
    {
      id: "hours-1",
      courtId: "court-1",
      dayOfWeek: 1,
      opensMinute: 480,
      closesMinute: 1320,
    },
  ],
  closures: [
    {
      id: "closure-1",
      courtId: "court-1",
      startsAt: "2026-06-29T01:00:00.000Z",
      endsAt: "2026-06-29T03:00:00.000Z",
      reason: "Maintenance",
    },
  ],
};

describe("CourtScheduleManager", () => {
  beforeEach(() => {
    vi.mocked(apiFetch).mockReset();
    refresh.mockReset();
  });

  afterEach(cleanup);

  it("replaces weekly hours with normalized minute values", async () => {
    vi.mocked(apiFetch).mockResolvedValueOnce(schedule.operatingHours);
    render(<CourtScheduleManager court={court} schedule={schedule} canEdit />);

    fireEvent.change(screen.getByLabelText("Monday opens"), { target: { value: "09:00" } });
    fireEvent.click(screen.getByRole("button", { name: "Save weekly hours" }));

    await waitFor(() =>
      expect(apiFetch).toHaveBeenCalledWith("/courts/court-1/operating-hours", {
        method: "PUT",
        body: {
          windows: [{ dayOfWeek: 1, opensMinute: 540, closesMinute: 1320 }],
        },
      }),
    );
    expect(refresh).toHaveBeenCalledOnce();
  });

  it("converts Manila-local closures to UTC", async () => {
    vi.mocked(apiFetch).mockResolvedValueOnce(schedule.closures[0]);
    render(<CourtScheduleManager court={court} schedule={schedule} canEdit />);

    fireEvent.change(screen.getByLabelText("Closure starts"), {
      target: { value: "2026-07-01T09:30" },
    });
    fireEvent.change(screen.getByLabelText("Closure ends"), {
      target: { value: "2026-07-01T11:00" },
    });
    fireEvent.change(screen.getByLabelText("Closure reason"), {
      target: { value: "Private event" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Add closure" }));

    await waitFor(() =>
      expect(apiFetch).toHaveBeenCalledWith("/courts/court-1/closures", {
        method: "POST",
        body: {
          startsAt: "2026-07-01T01:30:00.000Z",
          endsAt: "2026-07-01T03:00:00.000Z",
          reason: "Private event",
        },
      }),
    );
  });

  it("renders the schedule without mutation controls for read-only users", () => {
    render(<CourtScheduleManager court={court} schedule={schedule} canEdit={false} />);

    expect(screen.getByText(/Monday.*8:00 AM.*10:00 PM/)).toBeTruthy();
    expect(screen.queryByRole("button", { name: "Save weekly hours" })).toBeNull();
    expect(screen.queryByRole("button", { name: "Add closure" })).toBeNull();
  });

  it("renders end-of-day and split windows without ambiguous labels", () => {
    render(
      <CourtScheduleManager
        court={court}
        canEdit
        schedule={{
          closures: [],
          operatingHours: [
            {
              id: "morning",
              courtId: "court-1",
              dayOfWeek: 1,
              opensMinute: 480,
              closesMinute: 720,
            },
            {
              id: "evening",
              courtId: "court-1",
              dayOfWeek: 1,
              opensMinute: 780,
              closesMinute: 1440,
            },
          ],
        }}
      />,
    );

    expect((screen.getByLabelText("Monday window 1 opens") as HTMLInputElement).value).toBe(
      "08:00",
    );
    expect((screen.getByLabelText("Monday window 2 closes") as HTMLInputElement).value).toBe(
      "24:00",
    );
  });
});

describe("timeInputToMinute", () => {
  it("accepts end-of-day and rejects malformed values", () => {
    expect(timeInputToMinute("24:00")).toBe(1440);
    expect(() => timeInputToMinute("missing")).toThrow("Enter time as HH:mm");
  });
});
