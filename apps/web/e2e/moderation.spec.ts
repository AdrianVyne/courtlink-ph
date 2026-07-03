import { randomUUID } from "node:crypto";
import { expect, test } from "@playwright/test";
import { acceptNextPrompt, createDraftVenue, loginAs } from "./helpers";

test.describe("moderation (needs seeded API)", () => {
  test("reporting a venue creates a case; admin suspending removes it from public listings", async ({
    browser,
    request,
  }) => {
    const ownerContext = await browser.newContext();
    const ownerPage = await ownerContext.newPage();
    const ownerLoggedIn = await loginAs(ownerPage, "owner@demo.courtlink.ph");
    test.skip(!ownerLoggedIn, "API not running or demo owner seed missing");

    const name = `E2E Moderation ${randomUUID().slice(0, 8)}`;
    const venue = await createDraftVenue(ownerPage, { name });
    await ownerPage.context().request.post(`/api/v1/venues/${venue.id}/submit`);
    await ownerContext.close();

    const adminSetupContext = await browser.newContext();
    const adminSetupPage = await adminSetupContext.newPage();
    await loginAs(adminSetupPage, "admin@demo.courtlink.ph");
    const approve = await adminSetupPage
      .context()
      .request.post(`/api/v1/venues/admin/${venue.id}/approve`);
    expect(approve.ok(), await approve.text()).toBe(true);
    await adminSetupContext.close();

    const playerContext = await browser.newContext();
    const playerPage = await playerContext.newPage();
    const playerLoggedIn = await loginAs(playerPage, "player@demo.courtlink.ph");
    test.skip(!playerLoggedIn, "API not running or demo player seed missing");

    await playerPage.goto(`/courts/${venue.slug}`);
    await playerPage.waitForLoadState("networkidle");
    acceptNextPrompt(playerPage, "E2E test report — impersonating a real venue");
    await playerPage.getByRole("button", { name: "Report" }).click();
    await expect(playerPage.getByText("Report submitted. Thank you.")).toBeVisible();
    await playerContext.close();

    const beforeSuspend = await request.get(`/api/v1/venues/by-slug/${venue.slug}`);
    expect(beforeSuspend.ok()).toBe(true);

    const adminContext = await browser.newContext();
    const adminPage = await adminContext.newPage();
    await loginAs(adminPage, "admin@demo.courtlink.ph");
    await adminPage.goto("/admin/moderation");
    await adminPage.waitForLoadState("networkidle");
    // The moderation queue renders "subject <uuid>", not venue names — locate the card by id.
    const card = adminPage
      .locator("div")
      .filter({ has: adminPage.getByText(`subject ${venue.id}`) })
      .filter({ has: adminPage.getByRole("button", { name: "Suspend" }) })
      .last();
    await expect(card).toBeVisible();
    // The Reinstate button renders unconditionally, so wait for the suspend POST
    // itself before asserting — otherwise the public-resolution check races it.
    const suspendResponse = adminPage.waitForResponse(
      (response) =>
        response.url().includes("/api/v1/moderation/subjects/suspend") &&
        response.request().method() === "POST",
    );
    await card.getByRole("button", { name: "Suspend" }).click();
    expect((await suspendResponse).ok()).toBe(true);
    await expect(card.getByRole("button", { name: "Reinstate" })).toBeVisible();
    await adminContext.close();

    const afterSuspend = await request.get(`/api/v1/venues/by-slug/${venue.slug}`);
    expect(afterSuspend.status()).toBe(400); // suspended venues no longer resolve publicly
  });
});
