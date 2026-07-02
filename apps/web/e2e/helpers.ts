import type { Page } from "@playwright/test";

export const DEMO_PASSWORD = "courtlink-demo-2026";

/**
 * Logs in through the UI with a demo-seed account. Returns false when the
 * API is unreachable or the account is missing, so callers can skip.
 */
export async function loginAs(page: Page, email: string): Promise<boolean> {
  // A click before React hydrates falls back to a native GET submit (the same
  // race other specs guard with toPass loops). Sniff for the login POST to
  // tell the two apart quickly and retry until the handler is attached.
  for (let attempt = 0; attempt < 4; attempt++) {
    await page.goto("/login");
    // Let hydration finish: a native submit navigates instantly, aborting the
    // scripts, so without this wait every retry races the same way.
    await page.waitForLoadState("networkidle").catch(() => {});
    await page.getByLabel("Email").fill(email);
    await page.getByLabel("Password").fill(DEMO_PASSWORD);
    const loginResponse = page
      .waitForResponse((res) => res.url().includes("/api/v1/auth/login"), { timeout: 3000 })
      .catch(() => null);
    await page.getByRole("button", { name: "Log in" }).click();
    const response = await loginResponse;
    if (!response) continue; // pre-hydration native submit — try again
    if (!response.ok()) return false; // API rejected: seed missing or bad password
    try {
      // Generous: a cold dev server compiles /dashboard on first hit.
      await page.waitForURL("**/dashboard", { timeout: 15000 });
      return true;
    } catch {
      return false;
    }
  }
  return false;
}
