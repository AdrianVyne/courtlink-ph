import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { type CourtSummary, apiFetch } from "../lib/api";
import { CourtBooking } from "./court-booking";

vi.mock("../lib/api", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../lib/api")>();
  return { ...actual, apiFetch: vi.fn() };
});

const court: CourtSummary = {
  id: "court-1",
  venueId: "venue-1",
  name: "Court One",
  description: null,
  indoor: true,
  active: true,
  slotIncrementMin: 30,
  minimumDurationMin: 60,
  maximumDurationMin: 120,
};

describe("CourtBooking", () => {
  beforeEach(() => vi.mocked(apiFetch).mockReset());

  it("books only a UTC interval returned by server availability", async () => {
    vi.mocked(apiFetch)
      .mockResolvedValueOnce([
        {
          startsAt: "2026-06-22T01:00:00.000Z",
          endsAt: "2026-06-22T02:00:00.000Z",
          totalAmount: 250,
          currency: "PHP",
        },
        {
          startsAt: "2026-06-22T02:00:00.000Z",
          endsAt: "2026-06-22T03:00:00.000Z",
          totalAmount: 300,
          currency: "PHP",
        },
      ])
      .mockResolvedValueOnce({
        id: "booking-1",
        courtId: "court-1",
        playerId: "player-1",
        status: "HELD",
        startsAt: "2026-06-22T01:00:00.000Z",
        endsAt: "2026-06-22T02:00:00.000Z",
        quotedAmount: 250,
        currency: "PHP",
        proofDeadline: "2026-06-22T00:05:00.000Z",
        reviewDueAt: null,
      });

    render(<CourtBooking court={court} isAuthenticated />);
    fireEvent.change(screen.getByLabelText("Date"), { target: { value: "2026-06-22" } });
    fireEvent.click(screen.getByRole("button", { name: "Load available times" }));

    await waitFor(() =>
      expect(apiFetch).toHaveBeenCalledWith("/courts/court-1/availability", {
        query: { date: "2026-06-22", durationMin: 60 },
      }),
    );
    expect(screen.getByRole("button", { name: /9:00 AM.*10:00 AM/ })).toBeTruthy();
    expect(screen.queryByText("8:30 AM")).toBeNull();

    fireEvent.click(screen.getByRole("button", { name: /9:00 AM.*10:00 AM/ }));
    fireEvent.click(screen.getByRole("button", { name: "Hold for PHP 250.00" }));

    await waitFor(() =>
      expect(apiFetch).toHaveBeenLastCalledWith("/courts/court-1/hold", {
        method: "POST",
        body: {
          startsAt: "2026-06-22T01:00:00.000Z",
          endsAt: "2026-06-22T02:00:00.000Z",
        },
      }),
    );
  });
});
