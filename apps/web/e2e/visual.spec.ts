import { expect, test } from "@playwright/test";

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

for (const { path, name } of pages) {
  for (const viewport of viewports) {
    test(`${name} at ${viewport.label}px matches baseline`, async ({ page }) => {
      await page.setViewportSize({ width: viewport.width, height: viewport.height });
      await page.goto(path);
      await page.waitForLoadState("networkidle");
      await expect(page).toHaveScreenshot(`${name}-${viewport.label}.png`, {
        fullPage: true,
        animations: "disabled",
      });
    });
  }
}
