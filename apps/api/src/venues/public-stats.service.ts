export interface PublicStats {
  venues: number;
  cities: number;
  coaches: number;
}

export interface PublicStatsRepository {
  counts(): Promise<PublicStats>;
}

export class PublicStatsService {
  constructor(private readonly repository: PublicStatsRepository) {}

  async getPublicStats(): Promise<PublicStats> {
    const counts = await this.repository.counts();
    return {
      venues: Math.max(0, counts.venues),
      cities: Math.max(0, counts.cities),
      coaches: Math.max(0, counts.coaches),
    };
  }
}
