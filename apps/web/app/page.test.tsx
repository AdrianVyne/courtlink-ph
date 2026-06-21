import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import HomePage from "./page";

describe("HomePage", () => {
  it("introduces court and coach discovery", () => {
    render(<HomePage />);

    expect(screen.getByRole("heading", { name: "Book your next pickleball game." })).toBeTruthy();
    expect(screen.getByRole("link", { name: "Find a court" }).getAttribute("href")).toBe("/courts");
    expect(screen.getByRole("link", { name: "Find a coach" }).getAttribute("href")).toBe(
      "/coaches",
    );
  });
});
