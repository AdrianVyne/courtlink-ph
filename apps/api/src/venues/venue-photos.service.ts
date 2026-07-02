import { randomUUID } from "node:crypto";
import {
  type ObjectStorage,
  type ProofContentType,
  assertProofContentType,
  assertProofSize,
} from "../storage/object-storage.js";
import type { OrganizationRole } from "@courtlink/database";
import type { MembershipSummary } from "../tenancy/tenancy.service.js";
import type { VenueRepository, VenueSummary } from "./venue.service.js";

export const MAX_VENUE_PHOTOS = 8;
export const PHOTO_URL_TTL_SECONDS = 86400;
const ALT_TEXT_MIN = 5;
const ALT_TEXT_MAX = 200;
const MANAGE_ROLES: OrganizationRole[] = ["OWNER", "MANAGER"];

export interface VenuePhotoRecord {
  id: string;
  venueId: string;
  objectKey: string;
  altText: string;
  position: number;
  createdAt: Date;
}

export interface VenuePhotoRepository {
  countForVenue(venueId: string): Promise<number>;
  listForVenue(venueId: string): Promise<VenuePhotoRecord[]>;
  create(input: {
    venueId: string;
    objectKey: string;
    altText: string;
    position: number;
  }): Promise<VenuePhotoRecord>;
  findById(photoId: string): Promise<VenuePhotoRecord | null>;
  update(
    photoId: string,
    patch: { altText?: string; position?: number },
  ): Promise<VenuePhotoRecord>;
  swapPositions(photoIdA: string, photoIdB: string): Promise<void>;
  delete(photoId: string): Promise<void>;
}

export class VenuePhotoError extends Error {
  readonly code: string;
  constructor(code: string, message: string) {
    super(message);
    this.code = code;
    this.name = "VenuePhotoError";
  }
}

export interface PhotoUploadFile {
  buffer: Buffer;
  contentType: string;
  sizeBytes: number;
}

interface VenuePhotoServiceDeps {
  photos: VenuePhotoRepository;
  venues: Pick<VenueRepository, "findVenueById">;
  tenancy: {
    assertRole(
      userId: string,
      businessId: string,
      allowed: OrganizationRole[],
    ): Promise<Pick<MembershipSummary, "role">>;
  };
  storage: ObjectStorage;
  reencode: (
    buffer: Buffer,
    contentType: ProofContentType,
  ) => Promise<{ data: Buffer; contentType: string }>;
}

function normalizeAltText(value: string): string {
  const altText = value.trim();
  if (altText.length < ALT_TEXT_MIN || altText.length > ALT_TEXT_MAX) {
    throw new VenuePhotoError(
      "ALT_TEXT_INVALID",
      `Describe the photo in ${ALT_TEXT_MIN}-${ALT_TEXT_MAX} characters`,
    );
  }
  return altText;
}

export class VenuePhotoService {
  constructor(private readonly deps: VenuePhotoServiceDeps) {}

  private async requireManagedVenue(userId: string, venueId: string): Promise<VenueSummary> {
    const venue = await this.deps.venues.findVenueById(venueId);
    if (!venue) throw new VenuePhotoError("VENUE_NOT_FOUND", "Venue not found");
    await this.deps.tenancy.assertRole(userId, venue.businessId, MANAGE_ROLES);
    return venue;
  }

  private async requireOwnPhoto(venueId: string, photoId: string): Promise<VenuePhotoRecord> {
    const photo = await this.deps.photos.findById(photoId);
    if (!photo || photo.venueId !== venueId) {
      throw new VenuePhotoError("PHOTO_NOT_FOUND", "Photo not found");
    }
    return photo;
  }

  async addPhoto(input: {
    userId: string;
    venueId: string;
    altText: string;
    file: PhotoUploadFile;
  }): Promise<VenuePhotoRecord> {
    await this.requireManagedVenue(input.userId, input.venueId);
    const altText = normalizeAltText(input.altText);
    const contentType = assertProofContentType(input.file.contentType);
    assertProofSize(input.file.sizeBytes);

    const count = await this.deps.photos.countForVenue(input.venueId);
    if (count >= MAX_VENUE_PHOTOS) {
      throw new VenuePhotoError(
        "PHOTO_LIMIT_REACHED",
        `A venue can have at most ${MAX_VENUE_PHOTOS} photos`,
      );
    }

    // Always publish webp regardless of the uploaded format.
    const encoded = await this.deps.reencode(input.file.buffer, contentType);
    const objectKey = `venue-photos/${input.venueId}/${randomUUID()}.webp`;
    await this.deps.storage.putObject({
      key: objectKey,
      body: encoded.data,
      contentType: "image/webp",
    });

    return this.deps.photos.create({
      venueId: input.venueId,
      objectKey,
      altText,
      position: count,
    });
  }

  async updatePhoto(input: {
    userId: string;
    venueId: string;
    photoId: string;
    altText?: string | undefined;
    position?: number | undefined;
  }): Promise<VenuePhotoRecord> {
    await this.requireManagedVenue(input.userId, input.venueId);
    const photo = await this.requireOwnPhoto(input.venueId, input.photoId);

    if (input.position !== undefined) {
      if (
        !Number.isInteger(input.position) ||
        input.position < 0 ||
        input.position >= MAX_VENUE_PHOTOS
      ) {
        throw new VenuePhotoError(
          "PHOTO_POSITION_INVALID",
          `Position must be 0-${MAX_VENUE_PHOTOS - 1}`,
        );
      }
      if (input.position !== photo.position) {
        const siblings = await this.deps.photos.listForVenue(input.venueId);
        const occupant = siblings.find((entry) => entry.position === input.position);
        if (occupant) {
          await this.deps.photos.swapPositions(photo.id, occupant.id);
        } else {
          await this.deps.photos.update(photo.id, { position: input.position });
        }
      }
    }

    if (input.altText !== undefined) {
      return this.deps.photos.update(photo.id, { altText: normalizeAltText(input.altText) });
    }
    const updated = await this.deps.photos.findById(photo.id);
    return updated ?? photo;
  }

  async removePhoto(input: { userId: string; venueId: string; photoId: string }): Promise<void> {
    await this.requireManagedVenue(input.userId, input.venueId);
    const photo = await this.requireOwnPhoto(input.venueId, input.photoId);
    await this.deps.photos.delete(photo.id);
  }

  listForVenue(venueId: string): Promise<VenuePhotoRecord[]> {
    return this.deps.photos.listForVenue(venueId);
  }

  /** Signed URL for public consumption; only approved venues' photos are visible. */
  async publicPhotoUrl(photoId: string): Promise<string> {
    const photo = await this.deps.photos.findById(photoId);
    if (!photo) throw new VenuePhotoError("PHOTO_NOT_FOUND", "Photo not found");
    const venue = await this.deps.venues.findVenueById(photo.venueId);
    if (!venue || venue.status !== "APPROVED") {
      throw new VenuePhotoError("PHOTO_NOT_FOUND", "Photo not found");
    }
    return this.deps.storage.getSignedDownloadUrl(photo.objectKey, PHOTO_URL_TTL_SECONDS);
  }
}
