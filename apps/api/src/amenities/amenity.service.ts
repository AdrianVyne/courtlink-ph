export type AmenityScope = "VENUE" | "COURT" | "BOTH";

export interface AmenityCatalogEntry {
  id: string;
  key: string;
  name: string;
  scope: AmenityScope;
}

export type AmenityErrorCode = "AMENITY_UNKNOWN" | "AMENITY_SCOPE_INVALID";

export class AmenityError extends Error {
  constructor(
    readonly code: AmenityErrorCode,
    message: string,
  ) {
    super(message);
    this.name = "AmenityError";
  }
}

export interface AmenityRepository {
  listCatalog(): Promise<AmenityCatalogEntry[]>;
  findByKeys(keys: string[]): Promise<AmenityCatalogEntry[]>;
  setVenueAmenities(venueId: string, amenityIds: string[]): Promise<void>;
  setCourtAmenities(courtId: string, amenityIds: string[]): Promise<void>;
  listVenueAmenities(venueId: string): Promise<AmenityCatalogEntry[]>;
  listCourtAmenities(courtId: string): Promise<AmenityCatalogEntry[]>;
}

function dedupe(keys: string[]): string[] {
  return [...new Set(keys.map((key) => key.trim().toUpperCase()).filter(Boolean))];
}

export class AmenityService {
  constructor(private readonly repository: AmenityRepository) {}

  listCatalog(): Promise<AmenityCatalogEntry[]> {
    return this.repository.listCatalog();
  }

  listVenueAmenities(venueId: string): Promise<AmenityCatalogEntry[]> {
    return this.repository.listVenueAmenities(venueId);
  }

  listCourtAmenities(courtId: string): Promise<AmenityCatalogEntry[]> {
    return this.repository.listCourtAmenities(courtId);
  }

  async setVenueAmenities(venueId: string, keys: string[]): Promise<void> {
    const ids = await this.resolveIds(keys, "VENUE");
    await this.repository.setVenueAmenities(venueId, ids);
  }

  async setCourtAmenities(courtId: string, keys: string[]): Promise<void> {
    const ids = await this.resolveIds(keys, "COURT");
    await this.repository.setCourtAmenities(courtId, ids);
  }

  private async resolveIds(keys: string[], target: "VENUE" | "COURT"): Promise<string[]> {
    const wanted = dedupe(keys);
    if (wanted.length === 0) return [];
    const found = await this.repository.findByKeys(wanted);
    const byKey = new Map(found.map((entry) => [entry.key, entry]));
    const ids: string[] = [];
    for (const key of wanted) {
      const entry = byKey.get(key);
      if (!entry) {
        throw new AmenityError("AMENITY_UNKNOWN", `Unknown amenity: ${key}`);
      }
      if (entry.scope !== "BOTH" && entry.scope !== target) {
        throw new AmenityError(
          "AMENITY_SCOPE_INVALID",
          `Amenity ${key} cannot be applied to a ${target.toLowerCase()}`,
        );
      }
      ids.push(entry.id);
    }
    return ids;
  }
}
