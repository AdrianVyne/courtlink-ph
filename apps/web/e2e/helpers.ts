import { randomUUID } from "node:crypto";
import { expect, type Page } from "@playwright/test";

export const DEMO_PASSWORD = "courtlink-demo-2026";
export const E2E_PHOTO_ALT_PREFIX = "E2E uploaded venue cover";

interface VenuePhotoResponse {
  id: string;
  altText: string;
  position: number;
  url: string;
}

const E2E_COVER_PNG = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAQAAAAECAIAAAAmkwkpAAAACXBIWXMAAAPoAAAD6AG1e1JrAAAAEElEQVQImWPQn+cCRwzEcQC6kxER6dq7ngAAAABJRU5ErkJggg==",
  "base64",
);

/**
 * Logs in through the UI with a demo-seed account. Returns false when the
 * API is unreachable or the account is missing, so callers can skip.
 */
export async function loginAs(page: Page, email: string): Promise<boolean> {
  // A click before React hydrates falls back to a native GET submit (the same
  // race other specs guard with toPass loops). Sniff for the login POST to
  // tell the two apart quickly and retry until the handler is attached.
  for (let attempt = 0; attempt < 4; attempt++) {
    await page.goto("/login");
    // Let hydration finish: a native submit navigates instantly, aborting the
    // scripts, so without this wait every retry races the same way.
    await page.waitForLoadState("networkidle").catch(() => {});
    await page.getByLabel("Email").fill(email);
    await page.getByLabel("Password").fill(DEMO_PASSWORD);
    const loginResponse = page
      .waitForResponse((res) => res.url().includes("/api/v1/auth/login"), { timeout: 3000 })
      .catch(() => null);
    await page.getByRole("button", { name: "Log in" }).click();
    const response = await loginResponse;
    if (!response) continue; // pre-hydration native submit — try again
    if (!response.ok()) return false; // API rejected: seed missing or bad password
    try {
      // Generous: a cold dev server compiles /dashboard on first hit.
      await page.waitForURL("**/dashboard", { timeout: 15000 });
      return true;
    } catch {
      return false;
    }
  }
  return false;
}

export async function deleteE2EVenuePhotos(page: Page, venueId: string): Promise<void> {
  const list = await page.context().request.get(`/api/v1/venues/${venueId}/photos`);
  if (!list.ok()) return;
  const photos = (await list.json()) as VenuePhotoResponse[];
  for (const photo of photos) {
    if (!photo.altText.startsWith(E2E_PHOTO_ALT_PREFIX)) continue;
    await page.context().request.delete(`/api/v1/venues/${venueId}/photos/${photo.id}`);
  }
}

export async function uploadE2EVenueCoverPhoto(
  page: Page,
  venueId: string,
  altText: string,
): Promise<VenuePhotoResponse> {
  await deleteE2EVenuePhotos(page, venueId);

  const upload = await page.context().request.post(`/api/v1/venues/${venueId}/photos`, {
    headers: { "Idempotency-Key": randomUUID() },
    multipart: {
      altText,
      file: {
        name: "courtlink-e2e-cover.png",
        mimeType: "image/png",
        buffer: E2E_COVER_PNG,
      },
    },
  });
  expect(upload.ok(), await upload.text()).toBe(true);
  const photo = (await upload.json()) as VenuePhotoResponse;

  const promote = await page
    .context()
    .request.patch(`/api/v1/venues/${venueId}/photos/${photo.id}`, {
      data: { position: 0 },
    });
  expect(promote.ok(), await promote.text()).toBe(true);
  return (await promote.json()) as VenuePhotoResponse;
}
