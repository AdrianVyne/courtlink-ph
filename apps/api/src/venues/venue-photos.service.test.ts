import { describe, expect, it, vi } from "vitest";
import { ForbiddenTenantError } from "../tenancy/tenancy.service.js";
import {
  MAX_VENUE_PHOTOS,
  type VenuePhotoRecord,
  type VenuePhotoRepository,
  VenuePhotoError,
  VenuePhotoService,
} from "./venue-photos.service.js";
import type { VenueSummary } from "./venue.service.js";

const venue: VenueSummary = {
  id: "venue-1",
  businessId: "biz-1",
  name: "Riverside",
  slug: "riverside",
  description: null,
  status: "APPROVED",
  regionCode: "07",
  provinceCode: null,
  cityMunicipality: "Cebu City",
  barangay: null,
  streetAddress: "12 Riverside Drive",
  timezone: "Asia/Manila",
  approvedAt: new Date("2026-01-15T00:00:00Z"),
};

function photo(overrides: Partial<VenuePhotoRecord> = {}): VenuePhotoRecord {
  return {
    id: "photo-1",
    venueId: "venue-1",
    objectKey: "venue-photos/venue-1/a.webp",
    altText: "Covered courts at dusk",
    position: 0,
    createdAt: new Date("2026-06-01T00:00:00Z"),
    ...overrides,
  };
}

function makeService(overrides: {
  photos?: Partial<VenuePhotoRepository>;
  venueStatus?: VenueSummary["status"];
  memberRole?: "OWNER" | "MANAGER" | null;
}) {
  const photos: VenuePhotoRepository = {
    countForVenue: vi.fn().mockResolvedValue(0),
    listForVenue: vi.fn().mockResolvedValue([]),
    create: vi.fn().mockImplementation(async (input) => photo({ ...input, id: "photo-new" })),
    findById: vi.fn().mockResolvedValue(null),
    update: vi.fn().mockImplementation(async (_id, patch) => photo(patch)),
    swapPositions: vi.fn().mockResolvedValue(undefined),
    delete: vi.fn().mockResolvedValue(undefined),
    ...overrides.photos,
  };
  const storage = {
    putObject: vi.fn().mockResolvedValue(undefined),
    getSignedDownloadUrl: vi.fn().mockResolvedValue("https://signed.example/photo"),
  };
  const service = new VenuePhotoService({
    photos,
    venues: {
      findVenueById: vi
        .fn()
        .mockResolvedValue({ ...venue, status: overrides.venueStatus ?? "APPROVED" }),
    },
    tenancy: {
      assertRole: vi.fn().mockImplementation(async () => {
        if (!overrides.memberRole) throw new ForbiddenTenantError();
        return { role: overrides.memberRole };
      }),
    },
    storage,
    reencode: vi.fn().mockResolvedValue({ data: Buffer.from("webp"), contentType: "image/webp" }),
  });
  return { service, photos, storage };
}

const upload = {
  userId: "user-1",
  venueId: "venue-1",
  altText: "Covered courts at dusk",
  file: { buffer: Buffer.from("input"), contentType: "image/jpeg", sizeBytes: 1000 },
};

describe("VenuePhotoService.addPhoto", () => {
  it("stores a re-encoded webp and appends it at the next position", async () => {
    const { service, photos, storage } = makeService({
      memberRole: "MANAGER",
      photos: { countForVenue: vi.fn().mockResolvedValue(2) },
    });

    const created = await service.addPhoto(upload);

    expect(storage.putObject).toHaveBeenCalledWith(
      expect.objectContaining({ contentType: "image/webp" }),
    );
    const key = vi.mocked(storage.putObject).mock.calls[0]?.[0]?.key as string;
    expect(key).toMatch(/^venue-photos\/venue-1\/[0-9a-f-]+\.webp$/);
    expect(photos.create).toHaveBeenCalledWith(
      expect.objectContaining({ venueId: "venue-1", position: 2 }),
    );
    expect(created.id).toBe("photo-new");
  });

  it(`rejects upload ${MAX_VENUE_PHOTOS + 1} once the cap is reached`, async () => {
    const { service, storage } = makeService({
      memberRole: "OWNER",
      photos: { countForVenue: vi.fn().mockResolvedValue(MAX_VENUE_PHOTOS) },
    });

    await expect(service.addPhoto(upload)).rejects.toMatchObject({
      code: "PHOTO_LIMIT_REACHED",
    });
    expect(storage.putObject).not.toHaveBeenCalled();
  });

  it.each(["hi", "x".repeat(201)])("rejects alt text %#", async (altText) => {
    const { service } = makeService({ memberRole: "OWNER" });
    await expect(service.addPhoto({ ...upload, altText })).rejects.toMatchObject({
      code: "ALT_TEXT_INVALID",
    });
  });

  it("denies non-members before touching storage", async () => {
    const { service, storage } = makeService({ memberRole: null });
    await expect(service.addPhoto(upload)).rejects.toBeInstanceOf(ForbiddenTenantError);
    expect(storage.putObject).not.toHaveBeenCalled();
  });
});

describe("VenuePhotoService.updatePhoto", () => {
  it("swaps positions when the target position is occupied", async () => {
    const mine = photo({ id: "photo-a", position: 0 });
    const other = photo({ id: "photo-b", position: 3, objectKey: "venue-photos/venue-1/b.webp" });
    const { service, photos } = makeService({
      memberRole: "MANAGER",
      photos: {
        findById: vi.fn().mockResolvedValue(mine),
        listForVenue: vi.fn().mockResolvedValue([mine, other]),
      },
    });

    await service.updatePhoto({
      userId: "user-1",
      venueId: "venue-1",
      photoId: "photo-a",
      position: 3,
    });

    expect(photos.swapPositions).toHaveBeenCalledWith("photo-a", "photo-b");
    expect(photos.update).not.toHaveBeenCalledWith("photo-a", { position: 3 });
  });

  it("moves to a free position without a swap", async () => {
    const mine = photo({ id: "photo-a", position: 0 });
    const { service, photos } = makeService({
      memberRole: "MANAGER",
      photos: {
        findById: vi.fn().mockResolvedValue(mine),
        listForVenue: vi.fn().mockResolvedValue([mine]),
      },
    });

    await service.updatePhoto({
      userId: "user-1",
      venueId: "venue-1",
      photoId: "photo-a",
      position: 5,
    });

    expect(photos.swapPositions).not.toHaveBeenCalled();
    expect(photos.update).toHaveBeenCalledWith("photo-a", { position: 5 });
  });

  it("rejects photos that belong to another venue", async () => {
    const { service } = makeService({
      memberRole: "OWNER",
      photos: { findById: vi.fn().mockResolvedValue(photo({ venueId: "venue-2" })) },
    });

    await expect(
      service.updatePhoto({
        userId: "user-1",
        venueId: "venue-1",
        photoId: "photo-1",
        altText: "Updated alt text",
      }),
    ).rejects.toMatchObject({ code: "PHOTO_NOT_FOUND" });
  });
});

describe("VenuePhotoService.publicPhotoUrl", () => {
  it("returns a signed url for photos of approved venues", async () => {
    const { service, storage } = makeService({
      memberRole: null,
      photos: { findById: vi.fn().mockResolvedValue(photo()) },
    });

    const url = await service.publicPhotoUrl("photo-1");

    expect(url).toBe("https://signed.example/photo");
    expect(storage.getSignedDownloadUrl).toHaveBeenCalledWith("venue-photos/venue-1/a.webp", 86400);
  });

  it("hides photos of venues that are not approved", async () => {
    const { service } = makeService({
      memberRole: null,
      venueStatus: "DRAFT",
      photos: { findById: vi.fn().mockResolvedValue(photo()) },
    });

    await expect(service.publicPhotoUrl("photo-1")).rejects.toMatchObject({
      code: "PHOTO_NOT_FOUND",
    });
  });
});
