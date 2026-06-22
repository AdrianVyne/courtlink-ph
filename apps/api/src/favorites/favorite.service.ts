export interface FavoriteVenueSummary {
  id: string;
  name: string;
  slug: string;
  cityMunicipality: string;
  createdAt: Date;
}

export interface FavoriteRepository {
  venueExists(venueId: string): Promise<boolean>;
  add(userId: string, venueId: string): Promise<void>;
  remove(userId: string, venueId: string): Promise<void>;
  list(userId: string): Promise<FavoriteVenueSummary[]>;
  isFavorite(userId: string, venueId: string): Promise<boolean>;
}

export class FavoriteError extends Error {
  readonly code: string;
  constructor(code: string, message: string) {
    super(message);
    this.code = code;
    this.name = "FavoriteError";
  }
}

export class FavoriteService {
  constructor(private readonly repository: FavoriteRepository) {}

  async add(userId: string, venueId: string): Promise<void> {
    if (!(await this.repository.venueExists(venueId))) {
      throw new FavoriteError("VENUE_NOT_FOUND", "Venue not found");
    }
    await this.repository.add(userId, venueId);
  }

  remove(userId: string, venueId: string): Promise<void> {
    return this.repository.remove(userId, venueId);
  }

  list(userId: string): Promise<FavoriteVenueSummary[]> {
    return this.repository.list(userId);
  }

  isFavorite(userId: string, venueId: string): Promise<boolean> {
    return this.repository.isFavorite(userId, venueId);
  }
}
