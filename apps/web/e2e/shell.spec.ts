import { type Page, expect, test } from "@playwright/test";

/** Clicks the hamburger until the drawer opens — tolerates pre-hydration clicks. */
async function openDrawer(page: Page) {
  await expect(async () => {
    await page.getByRole("button", { name: "Open menu" }).click();
    await expect(page.getByRole("dialog")).toBeVisible({ timeout: 1000 });
  }).toPass();
}

test.describe("mobile navigation", () => {
  test.use({ viewport: { width: 375, height: 812 } });

  test("hamburger opens a focus-managed drawer that closes on Escape", async ({ page }) => {
    await page.goto("/");
    const trigger = page.getByRole("button", { name: "Open menu" });
    await expect(trigger).toBeVisible();
    await expect(trigger).toHaveAttribute("aria-expanded", "false");

    await openDrawer(page);
    const drawer = page.getByRole("dialog");
    await expect(drawer).toBeVisible();
    await expect(trigger).toHaveAttribute("aria-expanded", "true");

    const focusInDrawer = await drawer.evaluate((el) => el.contains(document.activeElement));
    expect(focusInDrawer).toBe(true);

    await page.keyboard.press("Escape");
    await expect(drawer).not.toBeVisible();
    await expect(trigger).toHaveAttribute("aria-expanded", "false");
  });

  test("drawer links navigate", async ({ page }) => {
    await page.goto("/");
    await openDrawer(page);
    await page.getByRole("dialog").getByRole("link", { name: "Courts" }).click();
    await expect(page).toHaveURL(/\/courts$/);
  });
});

test.describe("footer", () => {
  for (const path of ["/", "/courts", "/coaches"]) {
    test(`${path} renders the site footer with company and legal links`, async ({ page }) => {
      await page.goto(path);
      const footer = page.getByRole("contentinfo");
      await expect(footer).toBeVisible();
      for (const href of ["/about", "/terms", "/privacy", "/faq", "/contact"]) {
        await expect(footer.locator(`a[href="${href}"]`)).toHaveCount(1);
      }
      await expect(footer).toContainText("GCash");
    });
  }
});

test.describe("system pages", () => {
  test("unknown routes render the custom 404", async ({ page }) => {
    const response = await page.goto("/definitely-missing");
    expect(response?.status()).toBe(404);
    await expect(page.getByRole("heading", { name: "Out of bounds" })).toBeVisible();
    await expect(page.getByRole("link", { name: "Back to the court" })).toBeVisible();
  });
});
