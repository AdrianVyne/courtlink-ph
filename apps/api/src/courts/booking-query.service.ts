export interface BookingListItem {
  id: string;
  status: string;
  startsAt: string;
  endsAt: string;
  quotedAmount: number;
  currency: string;
  proofDeadline: string | null;
  reviewDueAt: string | null;
  court: { id: string; name: string };
  venue: { id: string; name: string; slug: string };
  submission: {
    id: string;
    status: string;
    channel: string;
    transactionRef: string;
    proofObjectKey: string;
  } | null;
  refund: { id: string; status: string; amount: number } | null;
}

export interface BookingQueryRepository {
  listForPlayer(playerId: string): Promise<BookingListItem[]>;
  listForVenues(venueIds: string[], statuses: string[]): Promise<BookingListItem[]>;
}

export class BookingQueryService {
  constructor(private readonly repository: BookingQueryRepository) {}

  listForPlayer(playerId: string): Promise<BookingListItem[]> {
    return this.repository.listForPlayer(playerId);
  }

  async listVenueQueue(venueIds: string[], statuses: string[]): Promise<BookingListItem[]> {
    if (venueIds.length === 0) return [];
    return this.repository.listForVenues(venueIds, statuses);
  }
}
