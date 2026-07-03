import { expect, test } from "@playwright/test";
import { loginAs } from "./helpers";

test.describe("promotions (needs seeded API)", () => {
  test("owner creates a promotion and deactivates it", async ({ page }) => {
    const loggedIn = await loginAs(page, "owner@demo.courtlink.ph");
    test.skip(!loggedIn, "API not running or demo owner seed missing");

    const title = `E2E Promo ${Date.now()}`;
    await page.goto("/manage");
    await page.waitForLoadState("networkidle");
    const promotionsSection = page.locator("div", { has: page.getByText("Promotions") }).last();

    await promotionsSection.getByLabel("Title").fill(title);
    await promotionsSection.getByLabel("Value").fill("15");
    await promotionsSection.getByLabel("Starts").fill("2026-01-01T00:00");
    await promotionsSection.getByLabel("Ends").fill("2030-01-01T00:00");
    await promotionsSection.getByRole("button", { name: "Add promotion" }).click();

    const entry = page.locator("li", { hasText: title });
    await expect(entry).toBeVisible();
    await expect(entry.getByText("Active")).toBeVisible();

    await entry.getByRole("button", { name: "Deactivate" }).click();
    await expect(entry.getByText("Inactive")).toBeVisible();
  });
});
