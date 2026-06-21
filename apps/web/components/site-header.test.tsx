import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { SiteHeader } from "./site-header";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), refresh: vi.fn() }),
}));

describe("SiteHeader", () => {
  it("shows guest actions when there is no session", () => {
    render(<SiteHeader session={null} />);

    expect(screen.getByRole("link", { name: "Courts" }).getAttribute("href")).toBe("/courts");
    expect(screen.getByRole("link", { name: "Coaches" }).getAttribute("href")).toBe("/coaches");
    expect(screen.getByRole("link", { name: "Log in" }).getAttribute("href")).toBe("/login");
    expect(screen.getByRole("link", { name: "Join CourtLink" }).getAttribute("href")).toBe(
      "/register",
    );
  });

  it("shows the member name and a logout control when signed in", () => {
    render(
      <SiteHeader
        session={{ id: "u1", email: "a@b.com", displayName: "Alex Player", roles: ["PLAYER"] }}
      />,
    );

    expect(screen.getByRole("link", { name: "Alex Player" }).getAttribute("href")).toBe(
      "/dashboard",
    );
    expect(screen.getByRole("button", { name: "Log out" })).toBeTruthy();
  });
});
