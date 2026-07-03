import { expect, test } from "@playwright/test";
import { loginAs } from "./helpers";

test.describe("favorites (needs seeded API)", () => {
  test("toggling a favorite persists across reload", async ({ page }) => {
    const loggedIn = await loginAs(page, "player@demo.courtlink.ph");
    test.skip(!loggedIn, "API not running or demo player seed missing");

    await page.goto("/courts/riverside-pickleball-demo");
    await page.waitForLoadState("networkidle");
    const toggle = page.getByRole("button", { name: /favorites/i });
    await expect(toggle).toBeVisible();

    // Start from a known state: unfavorite if already favorited from a prior run.
    if ((await toggle.getAttribute("aria-pressed")) === "true") {
      await toggle.click();
      await expect(toggle).toHaveAttribute("aria-pressed", "false");
    }

    await toggle.click();
    await expect(toggle).toHaveAttribute("aria-pressed", "true");
    await expect(toggle).toHaveText(/Saved/);

    await page.reload();
    await page.waitForLoadState("networkidle");
    const toggleAfterReload = page.getByRole("button", { name: /favorites/i });
    await expect(toggleAfterReload).toHaveAttribute("aria-pressed", "true");

    // Clean up: unfavorite so repeated local runs start from the same state.
    await toggleAfterReload.click();
    await expect(toggleAfterReload).toHaveAttribute("aria-pressed", "false");
  });
});
