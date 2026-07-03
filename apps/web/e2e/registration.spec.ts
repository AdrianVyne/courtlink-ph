import { randomUUID } from "node:crypto";
import { expect, test } from "@playwright/test";

test.describe("registration (needs API)", () => {
  test("submitting the register form creates an account and reaches the dashboard", async ({
    page,
  }) => {
    const probe = await page.request.get("/api/v1/stats/public").catch(() => null);
    test.skip(!probe?.ok(), "API is not running");

    const email = `e2e-register-${randomUUID().slice(0, 8)}@example.test`;

    await page.goto("/register");
    await page.waitForLoadState("networkidle");
    await page.getByLabel("Full name").fill("E2E Test Player");
    await page.getByLabel("Email").fill(email);
    await page.getByLabel("Password").fill("e2e-registration-password-2026");
    await page.getByRole("button", { name: "Create account" }).click();

    await page.waitForURL("**/dashboard", { timeout: 15000 });
    await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
  });
});
