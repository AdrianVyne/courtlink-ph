import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { GoogleSignIn } from "./google-sign-in";

afterEach(cleanup);

describe("GoogleSignIn", () => {
  it("shows a same-origin Google start link only when enabled", () => {
    const { rerender } = render(<GoogleSignIn enabled />);

    const link = screen.getByRole("link", { name: "Continue with Google" });
    expect(link.getAttribute("href")).toBe("/api/v1/auth/google/start?returnTo=%2Fdashboard");

    rerender(<GoogleSignIn enabled={false} />);
    expect(screen.queryByRole("link", { name: "Continue with Google" })).toBeNull();
  });

  it("maps callback failures to non-sensitive user messages", () => {
    const { rerender } = render(<GoogleSignIn enabled oauthError="GOOGLE_OAUTH_STATE_INVALID" />);
    expect(screen.getByRole("alert").textContent).toBe("Google sign-in expired. Please try again.");

    rerender(<GoogleSignIn enabled oauthError="raw-provider-detail" />);
    expect(screen.getByRole("alert").textContent).toBe("Google sign-in could not be completed.");
    expect(document.body.textContent).not.toContain("raw-provider-detail");
  });
});
