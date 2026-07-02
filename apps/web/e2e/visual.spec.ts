import path from "node:path";
import { expect, type Page, test } from "@playwright/test";

/**
 * Visual regression net. Baselines live in e2e/__screenshots__/ and are
 * committed. When a phase intentionally changes appearance, regenerate with
 * `pnpm playwright test e2e/visual.spec.ts --update-snapshots` in the same
 * commit and say so in the commit message. See e2e/README.md.
 *
 * Run these WITHOUT the API (or with the standard demo seed) so list pages
 * render deterministic empty/seed states.
 */
const pages = [
  { path: "/", name: "landing" },
  { path: "/courts", name: "courts" },
  { path: "/coaches", name: "coaches" },
  { path: "/login", name: "login" },
];

const viewports = [
  { width: 375, height: 812, label: "375" },
  { width: 1280, height: 800, label: "1280" },
];

const darkPages = [
  { path: "/", name: "landing" },
  { path: "/courts", name: "courts" },
];

async function snap(
  page: Page,
  target: string,
  viewport: { width: number; height: number },
  file: string,
) {
  await page.setViewportSize(viewport);
  await page.goto(target, { waitUntil: "load" });
  await expect(page.locator("main")).toBeVisible();
  await page.evaluate(() => document.fonts.ready);
  await expect(page).toHaveScreenshot(file, {
    fullPage: true,
    animations: "disabled",
    stylePath: path.join(__dirname, "screenshot.css"),
  });
}

for (const { path: target, name } of pages) {
  for (const viewport of viewports) {
    test(`${name} at ${viewport.label}px matches baseline`, async ({ page }) => {
      test.skip(
        !!process.env.CI,
        "Baselines are rendered on Windows; Linux CI font rendering differs. Run visual checks locally.",
      );
      await snap(page, target, viewport, `${name}-${viewport.label}.png`);
    });
  }
}

for (const { path: target, name } of darkPages) {
  for (const viewport of viewports) {
    test(`${name} (dark) at ${viewport.label}px matches baseline`, async ({ page }) => {
      test.skip(
        !!process.env.CI,
        "Baselines are rendered on Windows; Linux CI font rendering differs. Run visual checks locally.",
      );
      await page.addInitScript(() => window.localStorage.setItem("courtlink-theme", "dark"));
      await snap(page, target, viewport, `${name}-dark-${viewport.label}.png`);
    });
  }
}
