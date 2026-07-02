import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { Countdown } from "./countdown";
import { ToastProvider, useToast } from "./toast";

afterEach(cleanup);

function Pusher({ tone }: { tone?: "success" | "danger" }) {
  const { push } = useToast();
  return (
    <button onClick={() => push("Proof submitted.", tone)} type="button">
      trigger
    </button>
  );
}

describe("Toast", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it("shows a pushed message in a status region", () => {
    render(
      <ToastProvider>
        <Pusher />
      </ToastProvider>,
    );
    fireEvent.click(screen.getByRole("button", { name: "trigger" }));
    expect(screen.getByRole("status").textContent).toContain("Proof submitted.");
  });

  it("auto-dismisses after five seconds", () => {
    render(
      <ToastProvider>
        <Pusher />
      </ToastProvider>,
    );
    fireEvent.click(screen.getByRole("button", { name: "trigger" }));
    act(() => {
      vi.advanceTimersByTime(5100);
    });
    expect(screen.getByRole("status").textContent).not.toContain("Proof submitted.");
  });

  it("marks danger toasts with a tone attribute", () => {
    render(
      <ToastProvider>
        <Pusher tone="danger" />
      </ToastProvider>,
    );
    fireEvent.click(screen.getByRole("button", { name: "trigger" }));
    expect(
      screen.getByText("Proof submitted.").closest("[data-tone]")?.getAttribute("data-tone"),
    ).toBe("danger");
  });
});

describe("Countdown", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-07-02T10:00:00.000Z"));
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it("renders remaining minutes and seconds", () => {
    render(<Countdown until="2026-07-02T10:03:42.000Z" />);
    expect(screen.getByText("3:42")).toBeDefined();
  });

  it("ticks down every second", () => {
    render(<Countdown until="2026-07-02T10:03:42.000Z" />);
    act(() => {
      vi.advanceTimersByTime(2000);
    });
    expect(screen.getByText("3:40")).toBeDefined();
  });

  it("clamps at zero once expired", () => {
    render(<Countdown until="2026-07-02T09:59:00.000Z" />);
    expect(screen.getByText("0:00")).toBeDefined();
  });
});
