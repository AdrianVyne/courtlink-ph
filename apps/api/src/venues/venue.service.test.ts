import { describe, expect, it } from "vitest";
import {
  type CreateVenueInput,
  type PublicVenueFilters,
  VenueNotFoundError,
  VenueService,
  VenueStatusError,
  type VenueRepository,
  type VenueSummary,
  normalizeSlug,
} from "./venue.service.js";

class InMemoryVenueRepository implements VenueRepository {
  readonly venues: VenueSummary[] = [];

  async createVenue(input: CreateVenueInput): Promise<VenueSummary> {
    const venue: VenueSummary = {
      id: `venue-${this.venues.length + 1}`,
      businessId: input.businessId,
      name: input.name,
      slug: input.slug,
      description: input.description ?? null,
      status: "DRAFT",
      regionCode: input.regionCode,
      provinceCode: input.provinceCode ?? null,
      cityMunicipality: input.cityMunicipality,
      barangay: input.barangay ?? null,
      streetAddress: input.streetAddress,
      timezone: "Asia/Manila",
      approvedAt: null,
    };
    this.venues.push(venue);
    return venue;
  }

  async findVenueById(id: string): Promise<VenueSummary | null> {
    return this.venues.find((v) => v.id === id) ?? null;
  }

  async findVenueBySlug(slug: string): Promise<VenueSummary | null> {
    return this.venues.find((v) => v.slug === slug) ?? null;
  }

  async listPublicVenues(filters: PublicVenueFilters): Promise<VenueSummary[]> {
    return this.venues.filter(
      (v) =>
        v.status === "APPROVED" &&
        (!filters.regionCode || v.regionCode === filters.regionCode) &&
        (!filters.cityMunicipality || v.cityMunicipality === filters.cityMunicipality),
    );
  }

  async listVenuesForBusiness(businessId: string): Promise<VenueSummary[]> {
    return this.venues.filter((v) => v.businessId === businessId);
  }

  async approveVenue(id: string, approvedAt: Date): Promise<VenueSummary> {
    const venue = this.venues.find((v) => v.id === id);
    if (!venue) throw new VenueNotFoundError();
    venue.status = "APPROVED";
    venue.approvedAt = approvedAt;
    return venue;
  }

  async rejectVenue(id: string): Promise<VenueSummary> {
    const venue = this.venues.find((v) => v.id === id);
    if (!venue) throw new VenueNotFoundError();
    venue.status = "REJECTED";
    return venue;
  }

  async submitForReview(id: string): Promise<VenueSummary> {
    const venue = this.venues.find((v) => v.id === id);
    if (!venue) throw new VenueNotFoundError();
    venue.status = "PENDING_APPROVAL";
    return venue;
  }
}

function venueInput(overrides: Partial<CreateVenueInput> = {}): CreateVenueInput {
  return {
    businessId: "business-1",
    name: "Pickleball Pros Court",
    slug: "pickleball-pros-court",
    regionCode: "NCR",
    cityMunicipality: "Manila",
    streetAddress: "100 Sample St",
    ...overrides,
  };
}

describe("VenueService", () => {
  it("creates a venue in DRAFT and rejects invalid slugs", async () => {
    const service = new VenueService(new InMemoryVenueRepository());
    const venue = await service.createVenue(venueInput());
    expect(venue.status).toBe("DRAFT");
    await expect(service.createVenue(venueInput({ slug: "INVALID SLUG" }))).rejects.toThrow(
      "VENUE_SLUG_INVALID",
    );
  });

  it("walks DRAFT -> PENDING_APPROVAL -> APPROVED via super-admin actions", async () => {
    const service = new VenueService(new InMemoryVenueRepository());
    const venue = await service.createVenue(venueInput());

    await service.submitForReview(venue.id);
    const approved = await service.approveVenue(venue.id, new Date("2026-06-21T01:00:00.000Z"));

    expect(approved.status).toBe("APPROVED");
    expect(approved.approvedAt).toEqual(new Date("2026-06-21T01:00:00.000Z"));
  });

  it("prevents approval of venues that are not pending approval", async () => {
    const service = new VenueService(new InMemoryVenueRepository());
    const venue = await service.createVenue(venueInput());
    await expect(service.approveVenue(venue.id)).rejects.toBeInstanceOf(VenueStatusError);
  });

  it("only exposes APPROVED venues to the public listing", async () => {
    const repository = new InMemoryVenueRepository();
    const service = new VenueService(repository);
    const draftVenue = await service.createVenue(venueInput({ slug: "draft-court" }));
    const liveVenue = await service.createVenue(venueInput({ slug: "live-court" }));
    await service.submitForReview(liveVenue.id);
    await service.approveVenue(liveVenue.id);
    void draftVenue;

    const visible = await service.listPublicVenues({});
    expect(visible.map((v) => v.slug)).toEqual(["live-court"]);
  });

  it("normalizes slugs for marketing-friendly inputs", () => {
    expect(normalizeSlug("Pickleball Pros - Quezon City!")).toBe("pickleball-pros-quezon-city");
  });
});
