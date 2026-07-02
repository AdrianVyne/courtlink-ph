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

  const footerDestinations = [
    { href: "/about", heading: "Built for Filipino pickleball" },
    { href: "/contact", heading: "Get in touch" },
    { href: "/faq", heading: "Fair questions, straight answers" },
    { href: "/terms", heading: "Terms of service" },
    { href: "/privacy", heading: "Privacy" },
  ];

  for (const destination of footerDestinations) {
    test(`footer link ${destination.href} resolves to its content page`, async ({ page }) => {
      await page.goto("/");
      await page.getByRole("contentinfo").locator(`a[href="${destination.href}"]`).click();
      await expect(page).toHaveURL(new RegExp(`${destination.href}$`));
      await expect(page.getByRole("heading", { level: 1, name: destination.heading })).toBeVisible({
        timeout: 20000,
      });
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

test.describe("theme", () => {
  test("the toggle cycles to dark and the choice survives a reload", async ({ page }) => {
    await page.goto("/");
    const html = page.locator("html");
    await expect(html).toHaveAttribute("data-theme", "light");

    // The cycle passes dark every third click; retrying also absorbs clicks
    // that land before hydration attaches the handler.
    const toggle = page.getByRole("button", { name: /^Theme:/ });
    await expect(async () => {
      await toggle.click();
      await expect(html).toHaveAttribute("data-theme", "dark", { timeout: 700 });
    }).toPass();

    await page.reload();
    await expect(html).toHaveAttribute("data-theme", "dark");
    expect(await page.evaluate(() => window.localStorage.getItem("courtlink-theme"))).toBe("dark");
  });

  test("a stored dark preference applies before paint", async ({ page }) => {
    await page.addInitScript(() => window.localStorage.setItem("courtlink-theme", "dark"));
    await page.goto("/");
    await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");
  });
});

test.describe("motion", () => {
  test("reduced motion disables the hero reveal animation", async ({ page }) => {
    await page.emulateMedia({ reducedMotion: "reduce" });
    await page.goto("/");
    const reveal = page.locator(".reveal").first();
    await expect(reveal).toBeVisible();
    expect(await reveal.evaluate((el) => window.getComputedStyle(el).animationName)).toBe("none");
  });
});
