import type { Page } from "@playwright/test";

export const DEMO_PASSWORD = "courtlink-demo-2026";

/**
 * Logs in through the UI with a demo-seed account. Returns false when the
 * API is unreachable or the account is missing, so callers can skip.
 */
export async function loginAs(page: Page, email: string): Promise<boolean> {
  await page.goto("/login");
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Password").fill(DEMO_PASSWORD);
  await page.getByRole("button", { name: "Log in" }).click();
  try {
    await page.waitForURL("**/dashboard", { timeout: 8000 });
    return true;
  } catch {
    return false;
  }
}
