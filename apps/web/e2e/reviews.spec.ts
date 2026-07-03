import { expect, test } from "@playwright/test";
import { loginAs } from "./helpers";

/**
 * Consumes the seeded COMPLETED booking fixture from packages/database/prisma/seed.ts.
 * Re-run pnpm --dir packages/database db:seed before this spec on persistent local DBs.
 */
test.describe("reviews (needs seeded API, resettable fixture)", () => {
  test("player reviews a completed booking and the venue rating updates", async ({
    page,
    request,
  }) => {
    const loggedIn = await loginAs(page, "player@demo.courtlink.ph");
    test.skip(!loggedIn, "API not running or demo player seed missing");

    const venuesResponse = await request.get("/api/v1/venues").catch(() => null);
    test.skip(!venuesResponse?.ok(), "API is not running");
    const venues = (await venuesResponse?.json()) as Array<{ id: string; slug: string }>;
    const venue = venues.find((v) => v.slug === "riverside-pickleball-demo");
    test.skip(!venue, "demo venue is not seeded");

    const before = await request.get(`/api/v1/reviews/venues/${venue?.id}`);
    const beforeCount = (await before.json()).rating.count as number;

    await page.goto("/dashboard");
    await page.waitForLoadState("networkidle");
    const reviewForm = page.locator("form", {
      has: page.getByRole("button", { name: "Submit review" }),
    });
    test.skip(
      (await reviewForm.count()) === 0,
      "no unreviewed completed booking — already used or not seeded",
    );

    await reviewForm.getByLabel("Comment (optional)").fill("E2E automated review");
    await reviewForm.getByRole("button", { name: "Submit review" }).click();
    await expect(page.getByText("Thanks for your review.")).toBeVisible();

    const after = await request.get(`/api/v1/reviews/venues/${venue?.id}`);
    const afterJson = await after.json();
    expect(afterJson.rating.count).toBe(beforeCount + 1);
    expect(
      (afterJson.items as Array<{ comment: string | null }>).some(
        (item) => item.comment === "E2E automated review",
      ),
    ).toBe(true);
  });
});
