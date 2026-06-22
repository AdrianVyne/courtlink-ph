import { describe, expect, it } from "vitest";
import {
  AmenityError,
  AmenityService,
  type AmenityCatalogEntry,
  type AmenityRepository,
} from "./amenity.service.js";

const catalog: AmenityCatalogEntry[] = [
  { id: "a-parking", key: "PARKING", name: "Parking", scope: "VENUE" },
  { id: "a-cafe", key: "CAFE", name: "Cafe", scope: "VENUE" },
  { id: "a-indoor", key: "INDOOR", name: "Indoor court", scope: "COURT" },
  { id: "a-lights", key: "COURT_LIGHTS", name: "Court lighting", scope: "BOTH" },
];

class InMemoryRepo implements AmenityRepository {
  venueAmenities = new Map<string, string[]>();
  courtAmenities = new Map<string, string[]>();

  async listCatalog(): Promise<AmenityCatalogEntry[]> {
    return catalog;
  }
  async findByKeys(keys: string[]): Promise<AmenityCatalogEntry[]> {
    return catalog.filter((a) => keys.includes(a.key));
  }
  async setVenueAmenities(venueId: string, amenityIds: string[]): Promise<void> {
    this.venueAmenities.set(venueId, amenityIds);
  }
  async setCourtAmenities(courtId: string, amenityIds: string[]): Promise<void> {
    this.courtAmenities.set(courtId, amenityIds);
  }
  async listVenueAmenities(venueId: string): Promise<AmenityCatalogEntry[]> {
    const ids = this.venueAmenities.get(venueId) ?? [];
    return catalog.filter((a) => ids.includes(a.id));
  }
  async listCourtAmenities(courtId: string): Promise<AmenityCatalogEntry[]> {
    const ids = this.courtAmenities.get(courtId) ?? [];
    return catalog.filter((a) => ids.includes(a.id));
  }
}

function build() {
  const repo = new InMemoryRepo();
  return { repo, service: new AmenityService(repo) };
}

describe("amenity assignment", () => {
  it("assigns valid venue-scoped amenities", async () => {
    const { repo, service } = build();
    await service.setVenueAmenities("v1", ["PARKING", "COURT_LIGHTS"]);
    expect(repo.venueAmenities.get("v1")).toEqual(["a-parking", "a-lights"]);
  });

  it("rejects unknown amenity keys", async () => {
    const { service } = build();
    await expect(service.setVenueAmenities("v1", ["NOPE"])).rejects.toMatchObject({
      code: "AMENITY_UNKNOWN",
    });
  });

  it("rejects a court-only amenity on a venue", async () => {
    const { service } = build();
    await expect(service.setVenueAmenities("v1", ["INDOOR"])).rejects.toMatchObject({
      code: "AMENITY_SCOPE_INVALID",
    });
  });

  it("rejects a venue-only amenity on a court", async () => {
    const { service } = build();
    await expect(service.setCourtAmenities("c1", ["PARKING"])).rejects.toMatchObject({
      code: "AMENITY_SCOPE_INVALID",
    });
  });

  it("accepts BOTH-scoped amenities on either target", async () => {
    const { repo, service } = build();
    await service.setCourtAmenities("c1", ["INDOOR", "COURT_LIGHTS"]);
    expect(repo.courtAmenities.get("c1")).toEqual(["a-indoor", "a-lights"]);
  });

  it("deduplicates repeated keys", async () => {
    const { repo, service } = build();
    await service.setVenueAmenities("v1", ["PARKING", "PARKING", "CAFE"]);
    expect(repo.venueAmenities.get("v1")).toEqual(["a-parking", "a-cafe"]);
  });

  it("clears amenities when given an empty list", async () => {
    const { repo, service } = build();
    await service.setVenueAmenities("v1", []);
    expect(repo.venueAmenities.get("v1")).toEqual([]);
  });
});
