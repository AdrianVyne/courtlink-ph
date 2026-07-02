import { test, expect } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";

test.describe("public pages", () => {
  test("homepage loads and shows the site name", async ({ page }) => {
    await page.goto("/");
    await expect(page.locator("body")).toContainText("CourtLink");
  });

  test("hero search navigates to courts with the chosen city", async ({ page }) => {
    await page.goto("/");
    const city = page.getByRole("textbox", { name: "City" });
    // Retry the interaction until hydration has attached the submit handler.
    await expect(async () => {
      await city.fill("Cebu City");
      await page.getByRole("button", { name: "Search courts" }).click();
      await expect(page).toHaveURL(/\/courts\?city=Cebu(\+|%20)City/, { timeout: 2000 });
    }).toPass();
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
