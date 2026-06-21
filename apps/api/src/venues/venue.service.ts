import type { Venue, VenueStatus } from "@courtlink/database";

export type VenueSummary = {
  id: string;
  businessId: string;
  name: string;
  slug: string;
  description: string | null;
  status: VenueStatus;
  regionCode: string;
  provinceCode: string | null;
  cityMunicipality: string;
  barangay: string | null;
  streetAddress: string;
  timezone: string;
  approvedAt: Date | null;
};

export interface CreateVenueInput {
  businessId: string;
  name: string;
  slug: string;
  description?: string | null | undefined;
  regionCode: string;
  provinceCode?: string | null | undefined;
  cityMunicipality: string;
  barangay?: string | null | undefined;
  streetAddress: string;
}

export interface PublicVenueFilters {
  regionCode?: string | undefined;
  cityMunicipality?: string | undefined;
  query?: string | undefined;
  limit?: number | undefined;
}

export interface VenueRepository {
  createVenue(input: CreateVenueInput): Promise<VenueSummary>;
  findVenueById(id: string): Promise<VenueSummary | null>;
  findVenueBySlug(slug: string): Promise<VenueSummary | null>;
  listPublicVenues(filters: PublicVenueFilters): Promise<VenueSummary[]>;
  listVenuesForBusiness(businessId: string): Promise<VenueSummary[]>;
  approveVenue(id: string, approvedAt: Date): Promise<VenueSummary>;
  rejectVenue(id: string): Promise<VenueSummary>;
  submitForReview(id: string): Promise<VenueSummary>;
  listPendingVenues(): Promise<VenueSummary[]>;
}

export class VenueNotFoundError extends Error {
  readonly code = "VENUE_NOT_FOUND";
  constructor() {
    super("Venue not found");
    this.name = "VenueNotFoundError";
  }
}

export class VenueStatusError extends Error {
  readonly code = "VENUE_STATUS_INVALID";
  constructor(message: string) {
    super(message);
    this.name = "VenueStatusError";
  }
}

const SLUG_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

export function normalizeSlug(input: string): string {
  return input
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function assertSlug(slug: string): void {
  if (!SLUG_PATTERN.test(slug) || slug.length < 3 || slug.length > 80) {
    throw new Error("VENUE_SLUG_INVALID");
  }
}

export class VenueService {
  constructor(private readonly repository: VenueRepository) {}

  async createVenue(input: CreateVenueInput): Promise<VenueSummary> {
    assertSlug(input.slug);
    return this.repository.createVenue(input);
  }

  async submitForReview(id: string): Promise<VenueSummary> {
    const venue = await this.repository.findVenueById(id);
    if (!venue) throw new VenueNotFoundError();
    if (venue.status !== "DRAFT" && venue.status !== "REJECTED") {
      throw new VenueStatusError(`Cannot submit a venue in status ${venue.status}`);
    }
    return this.repository.submitForReview(id);
  }

  async approveVenue(id: string, now: Date = new Date()): Promise<VenueSummary> {
    const venue = await this.repository.findVenueById(id);
    if (!venue) throw new VenueNotFoundError();
    if (venue.status !== "PENDING_APPROVAL") {
      throw new VenueStatusError("Only PENDING_APPROVAL venues can be approved");
    }
    return this.repository.approveVenue(id, now);
  }

  async rejectVenue(id: string): Promise<VenueSummary> {
    const venue = await this.repository.findVenueById(id);
    if (!venue) throw new VenueNotFoundError();
    if (venue.status !== "PENDING_APPROVAL") {
      throw new VenueStatusError("Only PENDING_APPROVAL venues can be rejected");
    }
    return this.repository.rejectVenue(id);
  }

  listPublicVenues(filters: PublicVenueFilters): Promise<VenueSummary[]> {
    return this.repository.listPublicVenues({ ...filters, limit: filters.limit ?? 50 });
  }

  listVenuesForBusiness(businessId: string): Promise<VenueSummary[]> {
    return this.repository.listVenuesForBusiness(businessId);
  }

  listPendingVenues(): Promise<VenueSummary[]> {
    return this.repository.listPendingVenues();
  }

  findVenueById(id: string): Promise<VenueSummary | null> {
    return this.repository.findVenueById(id);
  }

  findVenueBySlug(slug: string): Promise<VenueSummary | null> {
    return this.repository.findVenueBySlug(slug);
  }
}

export function toVenueSummary(venue: Venue): VenueSummary {
  return {
    id: venue.id,
    businessId: venue.businessId,
    name: venue.name,
    slug: venue.slug,
    description: venue.description,
    status: venue.status,
    regionCode: venue.regionCode,
    provinceCode: venue.provinceCode,
    cityMunicipality: venue.cityMunicipality,
    barangay: venue.barangay,
    streetAddress: venue.streetAddress,
    timezone: venue.timezone,
    approvedAt: venue.approvedAt,
  };
}
