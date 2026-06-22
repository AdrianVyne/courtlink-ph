export interface CoachBookingListItem {
  id: string;
  status: string;
  startsAt: string;
  endsAt: string;
  location: string;
  amount: number;
  currency: string;
  player: { displayName: string };
  submission: {
    id: string;
    status: string;
    channel: string;
    transactionRef: string;
  } | null;
}

export interface PlayerCoachRequestItem {
  id: string;
  status: string;
  startsAt: string;
  endsAt: string;
  location: string;
  groupSize: number;
  skillLevel: string;
  offers: Array<{
    id: string;
    coachId: string;
    amount: number;
    status: string;
    expiresAt: string;
    message: string | null;
  }>;
  booking: { id: string; status: string } | null;
}

export interface DirectedRequestItem {
  id: string;
  status: string;
  startsAt: string;
  endsAt: string;
  location: string;
  groupSize: number;
  skillLevel: string;
  goals: string | null;
  notes: string | null;
  player: { displayName: string };
}

export interface CoachQueryRepository {
  listDirectedPendingForCoach(coachId: string): Promise<DirectedRequestItem[]>;
  listBookingsForCoach(coachId: string): Promise<CoachBookingListItem[]>;
  listRequestsForPlayer(playerId: string): Promise<PlayerCoachRequestItem[]>;
}

export class CoachQueryService {
  constructor(private readonly repository: CoachQueryRepository) {}

  listBookingsForCoach(coachId: string): Promise<CoachBookingListItem[]> {
    return this.repository.listBookingsForCoach(coachId);
  }

  listDirectedPendingForCoach(coachId: string): Promise<DirectedRequestItem[]> {
    return this.repository.listDirectedPendingForCoach(coachId);
  }

  listRequestsForPlayer(playerId: string): Promise<PlayerCoachRequestItem[]> {
    return this.repository.listRequestsForPlayer(playerId);
  }
}
