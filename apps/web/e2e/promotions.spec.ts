import { randomUUID } from "node:crypto";
import { expect, test } from "@playwright/test";
import { loginAs } from "./helpers";

test.describe("promotions (needs seeded API)", () => {
  test("owner creates a promotion and deactivates it", async ({ page }) => {
    const loggedIn = await loginAs(page, "owner@demo.courtlink.ph");
    test.skip(!loggedIn, "API not running or demo owner seed missing");

    const runToken = randomUUID().slice(0, 8);
    const title = `E2E Promo ${runToken}`;
    const startMinuteOffset = Number.parseInt(runToken, 16) % (180 * 24 * 60);
    const startsAt = new Date(Date.UTC(2026, 0, 1, 0, startMinuteOffset));
    const startsAtInput = startsAt.toISOString().slice(0, 16);
    await page.goto("/manage");
    await page.waitForLoadState("networkidle");
    const promotionsSection = page.locator("div", { has: page.getByText("Promotions") }).last();

    await promotionsSection.getByLabel("Title").fill(title);
    await promotionsSection.getByLabel("Value").fill("15");
    await promotionsSection.getByLabel("Starts").fill(startsAtInput);
    await promotionsSection.getByLabel("Ends").fill("2030-01-01T00:00");
    const createResponse = page.waitForResponse(
      (response) =>
        response.url().includes("/promotions/venues/") && response.request().method() === "POST",
    );
    const createRefreshResponse = page.waitForResponse(
      (response) => response.url().includes("/manage") && response.url().includes("_rsc="),
    );
    await promotionsSection.getByRole("button", { name: "Add promotion" }).click();
    await createResponse;
    await createRefreshResponse;

    const entry = promotionsSection.getByRole("listitem").filter({
      has: page.getByText(title, { exact: true }),
    });
    await expect(entry).toBeVisible();
    await expect(entry.getByText("Active")).toBeVisible();

    const deactivateResponse = page.waitForResponse(
      (response) =>
        response.url().includes("/promotions/") && response.url().endsWith("/deactivate"),
    );
    const refreshResponse = page.waitForResponse(
      (response) => response.url().includes("/manage") && response.url().includes("_rsc="),
    );
    await entry.getByRole("button", { name: "Deactivate" }).click();
    await deactivateResponse;
    await refreshResponse;
    await expect(entry.getByText("Inactive")).toBeVisible({ timeout: 15_000 });
  });
});
