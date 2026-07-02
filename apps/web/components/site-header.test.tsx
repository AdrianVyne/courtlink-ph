import { cleanup, render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { SiteHeader } from "./site-header";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), refresh: vi.fn() }),
  usePathname: () => "/",
}));

afterEach(cleanup);

describe("SiteHeader", () => {
  it("shows primary navigation and guest actions when there is no session", () => {
    render(<SiteHeader session={null} />);

    const nav = screen.getByRole("navigation", { name: "Primary navigation" });
    expect(within(nav).getByRole("link", { name: "Courts" }).getAttribute("href")).toBe("/courts");
    expect(within(nav).getByRole("link", { name: "Coaches" }).getAttribute("href")).toBe(
      "/coaches",
    );

    const loginLinks = screen.getAllByRole("link", { name: "Log in" });
    expect(loginLinks.some((link) => link.getAttribute("href") === "/login")).toBe(true);
    const joinLinks = screen.getAllByRole("link", { name: "Join CourtLink" });
    expect(joinLinks.some((link) => link.getAttribute("href") === "/register")).toBe(true);
  });

  it("shows the member name and a logout control when signed in", () => {
    render(
      <SiteHeader
        session={{ id: "u1", email: "a@b.com", displayName: "Alex Player", roles: ["PLAYER"] }}
      />,
    );

    const nameLinks = screen.getAllByRole("link", { name: "Alex Player" });
    expect(nameLinks.some((link) => link.getAttribute("href") === "/dashboard")).toBe(true);
    expect(screen.getAllByRole("button", { name: "Log out" }).length).toBeGreaterThan(0);
  });

  it("renders the mobile menu trigger", () => {
    render(<SiteHeader session={null} />);
    expect(screen.getByRole("button", { name: "Open menu" })).toBeTruthy();
  });
});
