import { test, expect } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";

test.describe("public pages", () => {
  test("homepage loads and shows the site name", async ({ page }) => {
    await page.goto("/");
    await expect(page.locator("body")).toContainText("CourtLink");
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

test.describe("accessibility (WCAG 2.2 AA)", () => {
  const pages = ["/", "/courts", "/coaches", "/login", "/register"];

  for (const path of pages) {
    test(`${path} passes axe accessibility audit`, async ({ page }) => {
      await page.goto(path);
      const results = await new AxeBuilder({ page })
        .withTags(["wcag2a", "wcag2aa", "wcag22aa"])
        .analyze();
      expect(results.violations).toEqual([]);
    });
  }
});
