import { expect, test } from "@playwright/test";
import { loginAs } from "./helpers";

test.describe("venue amenities (needs seeded API)", () => {
  test("owner saves an amenity and it persists after reload", async ({ page }) => {
    const loggedIn = await loginAs(page, "owner@demo.courtlink.ph");
    test.skip(!loggedIn, "API not running or demo owner seed missing");

    const mineResponse = await page.context().request.get("/api/v1/venues/mine");
    expect(mineResponse.ok(), await mineResponse.text()).toBe(true);
    const mine = (await mineResponse.json()) as Array<{ venue: { id: string } }>;
    const venueId = mine[0]?.venue.id;
    test.skip(!venueId, "demo owner has no venue");
    const originalResponse = await page
      .context()
      .request.get(`/api/v1/venues/${venueId}/amenities`);
    expect(originalResponse.ok(), await originalResponse.text()).toBe(true);
    const original = (await originalResponse.json()) as { amenities: string[] };

    await page.goto("/manage");
    await page.waitForLoadState("networkidle");
    // The owner may have multiple venues (e.g. venue-approval.spec.ts creates
    // one during the same suite run), and /manage renders one workspace per
    // owned venue, so scope everything to the seeded demo venue's own block.
    const venueWorkspace = page
      .locator("div")
      .filter({ has: page.getByRole("heading", { name: "Riverside Pickleball", exact: true }) })
      .last();
    const amenitiesSection = venueWorkspace.locator("section", {
      has: page.getByText("Amenities"),
    });
    const unchecked = amenitiesSection.locator('input[name="amenities"]:not(:checked)').first();
    await expect(unchecked).toBeAttached();
    const label = unchecked.locator("xpath=ancestor::label[1]");
    const labelText = (await label.textContent())?.trim();

    try {
      await unchecked.check();
      await amenitiesSection.getByRole("button", { name: "Save amenities" }).click();
      await expect(amenitiesSection.getByText("Saved")).toBeVisible();

      await page.reload();
      const reloadedWorkspace = page
        .locator("div")
        .filter({ has: page.getByRole("heading", { name: "Riverside Pickleball", exact: true }) })
        .last();
      const afterReload = reloadedWorkspace
        .locator("section", { has: page.getByText("Amenities") })
        .locator("label", { hasText: labelText ?? "" })
        .locator('input[name="amenities"]');
      await expect(afterReload).toBeChecked();
    } finally {
      await page.context().request.put(`/api/v1/venues/${venueId}/amenities`, {
        data: { amenities: original.amenities },
      });
    }
  });
});
