import { test, expect } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";

test.describe("public pages", () => {
  test("homepage loads and shows the site name", async ({ page }) => {
    await page.goto("/");
    await expect(page.locator("body")).toContainText("CourtLink");
  });

  test("hero search navigates to courts with the chosen city", async ({ page }) => {
    await page.goto("/");
    // The form works pre-hydration too (native GET to /courts), so a single
    // fill+submit is reliable; the generous timeout covers first compile of
    // /courts on a cold dev server.
    await page.getByRole("textbox", { name: "City" }).fill("Cebu City");
    await page.getByRole("button", { name: "Search courts" }).click();
    await expect(page).toHaveURL(/\/courts\?city=Cebu(\+|%20)City/, { timeout: 20000 });
  });

  test("faq accordion expands an answer", async ({ page }) => {
    await page.goto("/");
    const question = page.getByText("How do booking holds work?");
    await question.scrollIntoViewIfNeeded();
    await question.click();
    await expect(page.getByText("Creating a booking places a 5-minute hold")).toBeVisible();
  });

  test("how-it-works tabs switch with mouse and keyboard", async ({ page }) => {
    await page.goto("/");
    const ownersTab = page.getByRole("tab", { name: "For venues & coaches" });
    await expect(async () => {
      await ownersTab.click();
      await expect(page.getByRole("tabpanel").getByText("List your courts or profile")).toBeVisible(
        { timeout: 2000 },
      );
    }).toPass();

    await ownersTab.focus();
    await page.keyboard.press("ArrowRight");
    await expect(page.getByRole("tabpanel").getByText("Find your court or coach")).toBeVisible();
  });

  test("courts page loads", async ({ page }) => {
    await page.goto("/courts");
    await expect(page.locator("h1")).toBeVisible();
  });

  test("coaches page loads", async ({ page }) => {
    await page.goto("/coaches");
    await expect(page.locator("h1")).toContainText("Coaches");
  });

  test("login page loads and shows form", async ({ page }) => {
    await page.goto("/login");
    await expect(page.locator("h1")).toContainText("Welcome back");
    await expect(page.locator('button[type="submit"]')).toBeVisible();
  });

  test("register page loads", async ({ page }) => {
    await page.goto("/register");
    await expect(page.locator("h1")).toBeVisible();
  });
});

test.describe("discovery filters", () => {
  test("an active city filter renders as a removable chip", async ({ page }) => {
    await page.goto("/courts?city=Cebu+City&maxPrice=500");
    const chip = page.getByRole("link", { name: "Remove filter: Cebu City" });
    await expect(chip).toBeVisible();
    await expect(page.getByRole("link", { name: "Remove filter: ≤ ₱500/hr" })).toBeVisible();

    await chip.click();
    await expect(page).toHaveURL(/\/courts\?maxPrice=500$/);
    await expect(page.getByRole("link", { name: "Remove filter: Cebu City" })).toHaveCount(0);
  });

  test("the mobile filter sheet opens and closes", async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 812 });
    await page.goto("/courts");
    const trigger = page.getByRole("button", { name: /Filters/ });
    await expect(async () => {
      await trigger.click();
      await expect(page.getByRole("dialog", { name: "Search filters" })).toBeVisible({
        timeout: 1000,
      });
    }).toPass();
    await page.keyboard.press("Escape");
    await expect(page.getByRole("dialog", { name: "Search filters" })).not.toBeVisible();
  });
});

test.describe("detail pages (need a seeded API)", () => {
  test("venue detail renders and passes axe", async ({ page, request }) => {
    const response = await request.get("/api/v1/venues").catch(() => null);
    test.skip(!response || !response.ok(), "API is not running");
    const venues = (await response?.json()) as Array<{ slug: string }>;
    test.skip(!Array.isArray(venues) || venues.length === 0, "no venues seeded");

    await page.emulateMedia({ reducedMotion: "reduce" });
    await page.goto(`/courts/${venues[0]?.slug}`);
    await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
    const results = await new AxeBuilder({ page })
      .withTags(["wcag2a", "wcag2aa", "wcag22aa"])
      .analyze();
    expect(results.violations).toEqual([]);
  });

  test("coach detail renders and passes axe", async ({ page, request }) => {
    const response = await request.get("/api/v1/coaches").catch(() => null);
    test.skip(!response || !response.ok(), "API is not running");
    const coaches = (await response?.json()) as Array<{ id: string }>;
    test.skip(!Array.isArray(coaches) || coaches.length === 0, "no coaches seeded");

    await page.emulateMedia({ reducedMotion: "reduce" });
    await page.goto(`/coaches/${coaches[0]?.id}`);
    await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
    const results = await new AxeBuilder({ page })
      .withTags(["wcag2a", "wcag2aa", "wcag22aa"])
      .analyze();
    expect(results.violations).toEqual([]);
  });
});

test.describe("accessibility (WCAG 2.2 AA)", () => {
  const pages = ["/", "/courts", "/coaches", "/login", "/register"];

  for (const path of pages) {
    test(`${path} passes axe accessibility audit`, async ({ page }) => {
      // Reduced motion keeps entry animations from being scanned mid-fade,
      // which would report transient contrast values.
      await page.emulateMedia({ reducedMotion: "reduce" });
      await page.goto(path);
      const results = await new AxeBuilder({ page })
        .withTags(["wcag2a", "wcag2aa", "wcag22aa"])
        .analyze();
      expect(results.violations).toEqual([]);
    });
  }
});
