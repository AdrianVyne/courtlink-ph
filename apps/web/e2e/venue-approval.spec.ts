import { expect, test } from "@playwright/test";
import { createDraftVenue, loginAs } from "./helpers";

test.describe("venue approval (needs seeded API)", () => {
  test("admin approving a pending venue makes it publicly visible", async ({
    browser,
    request,
  }) => {
    const ownerContext = await browser.newContext();
    const ownerPage = await ownerContext.newPage();
    const ownerLoggedIn = await loginAs(ownerPage, "owner@demo.courtlink.ph");
    test.skip(!ownerLoggedIn, "API not running or demo owner seed missing");

    const venue = await createDraftVenue(ownerPage, { name: "E2E Approval Test Venue" });
    const submit = await ownerPage.context().request.post(`/api/v1/venues/${venue.id}/submit`);
    expect(submit.ok(), await submit.text()).toBe(true);
    await ownerContext.close();

    const before = await request.get(`/api/v1/venues/by-slug/${venue.slug}`);
    expect(before.status()).toBe(400); // not APPROVED yet, so not publicly resolvable

    const adminContext = await browser.newContext();
    const adminPage = await adminContext.newPage();
    const adminLoggedIn = await loginAs(adminPage, "admin@demo.courtlink.ph");
    test.skip(!adminLoggedIn, "API not running or demo admin seed missing");

    await adminPage.goto("/admin");
    await adminPage.waitForLoadState("networkidle");
    const card = adminPage
      .locator("div")
      .filter({ hasText: venue.name })
      .filter({ has: adminPage.getByRole("button", { name: "Approve" }) })
      .last();
    await expect(card).toBeVisible();

    // Use API to approve to ensure we approve the exact venue we created
    // (UI selector is ambiguous with accumulated test data from multiple test runs)
    const approveResponse = await adminPage
      .context()
      .request.post(`/api/v1/venues/admin/${venue.id}/approve`);
    expect(approveResponse.ok(), await approveResponse.text()).toBe(true);
    await adminContext.close();

    const after = await request.get(`/api/v1/venues/by-slug/${venue.slug}`);
    expect(after.ok()).toBe(true);
    expect((await after.json()).status).toBe("APPROVED");
  });
});
