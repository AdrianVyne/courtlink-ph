import { expect, test } from "@playwright/test";
import { loginAs } from "./helpers";

test.describe("favorites (needs seeded API)", () => {
  test("toggling a favorite persists across reload", async ({ page }) => {
    const loggedIn = await loginAs(page, "player@demo.courtlink.ph");
    test.skip(!loggedIn, "API not running or demo player seed missing");

    await page.goto("/courts/riverside-pickleball-demo");
    const toggle = page.getByRole("button", { name: /favorites/i });
    await expect(toggle).toBeVisible();

    // Start from a known state: unfavorite if already favorited from a prior run.
    if ((await toggle.getAttribute("aria-pressed")) === "true") {
      await expect(async () => {
        await toggle.click();
        await expect(toggle).toHaveAttribute("aria-pressed", "false");
      }).toPass();
    }

    await expect(async () => {
      await toggle.click();
      await expect(toggle).toHaveAttribute("aria-pressed", "true");
      await expect(toggle).toHaveText(/Saved/);
    }).toPass();

    await page.reload();
    const toggleAfterReload = page.getByRole("button", { name: /favorites/i });
    await expect(toggleAfterReload).toHaveAttribute("aria-pressed", "true");

    // Clean up: unfavorite so repeated local runs start from the same state.
    await expect(async () => {
      await toggleAfterReload.click();
      await expect(toggleAfterReload).toHaveAttribute("aria-pressed", "false");
    }).toPass();
  });
});
