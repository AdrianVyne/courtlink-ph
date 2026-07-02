import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";
import { loginAs } from "./helpers";

test.describe("auth forms", () => {
  test("password visibility toggle flips the input type", async ({ page }) => {
    await page.goto("/login");
    const password = page.getByLabel("Password");
    await password.fill("secret-value");
    await expect(password).toHaveAttribute("type", "password");

    const toggle = page.getByRole("button", { name: "Show password" });
    await expect(async () => {
      await toggle.click();
      await expect(page.getByLabel("Password")).toHaveAttribute("type", "text", {
        timeout: 1000,
      });
    }).toPass();
    await page.getByRole("button", { name: "Hide password" }).click();
    await expect(page.getByLabel("Password")).toHaveAttribute("type", "password");
  });

  test("bad credentials surface an inline alert", async ({ page }) => {
    await page.goto("/login");
    await page.getByLabel("Email").fill("nobody@example.com");
    await page.getByLabel("Password").fill("definitely-wrong");
    await page.getByRole("button", { name: "Log in" }).click();
    await expect(page.getByRole("alert")).toBeVisible({ timeout: 10000 });
  });
});

test.describe("dashboard (needs seeded API)", () => {
  test("player dashboard renders and passes axe", async ({ page }) => {
    const loggedIn = await loginAs(page, "player@demo.courtlink.ph");
    test.skip(!loggedIn, "API not running or demo seed missing");

    await page.emulateMedia({ reducedMotion: "reduce" });
    await expect(page.getByRole("heading", { level: 1 })).toContainText("Welcome");
    const results = await new AxeBuilder({ page })
      .withTags(["wcag2a", "wcag2aa", "wcag22aa"])
      .analyze();
    expect(results.violations).toEqual([]);
  });
});
