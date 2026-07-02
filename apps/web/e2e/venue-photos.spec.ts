import { expect, test } from "@playwright/test";
import {
  E2E_PHOTO_ALT_PREFIX,
  deleteE2EVenuePhotos,
  loginAs,
  uploadE2EVenueCoverPhoto,
} from "./helpers";

test.describe("venue photos (needs seeded API)", () => {
  test("owner upload appears as the cover photo on court discovery", async ({ page, request }) => {
    const venuesResponse = await request.get("/api/v1/venues").catch(() => null);
    test.skip(!venuesResponse || !venuesResponse.ok(), "API is not running");
    const venues = (await venuesResponse.json()) as Array<{
      id: string;
      name: string;
      slug: string;
    }>;
    const venue = venues.find((item) => item.slug === "riverside-pickleball-demo");
    test.skip(!venue, "demo venue is not seeded");

    const loggedIn = await loginAs(page, "owner@demo.courtlink.ph");
    test.skip(!loggedIn, "API not running or demo owner seed missing");

    const altText = `${E2E_PHOTO_ALT_PREFIX} ${Date.now()}`;
    const photo = await uploadE2EVenueCoverPhoto(page, venue.id, altText);

    try {
      await page.goto("/courts");
      const card = page.locator(`a[href="/courts/${venue.slug}"]`);
      await expect(card).toBeVisible();

      const image = card.getByRole("img", { name: altText });
      await expect(image).toBeVisible();
      await expect(image).toHaveAttribute("src", photo.url);
      await expect(image).toHaveJSProperty("naturalWidth", 4);
    } finally {
      await deleteE2EVenuePhotos(page, venue.id);
    }
  });
});
