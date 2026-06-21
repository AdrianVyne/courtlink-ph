import { BookingStatus } from "./booking-lifecycle.js";

const proofWindowMilliseconds = 5 * 60 * 1000;

export interface CreateCourtHoldInput {
  courtId: string;
  playerId: string;
  createdAt: Date;
}

export interface CourtHold {
  courtId: string;
  playerId: string;
  status: BookingStatus.Held;
  proofDeadline: Date;
}

export function createCourtHold(input: CreateCourtHoldInput): CourtHold {
  return {
    courtId: input.courtId,
    playerId: input.playerId,
    status: BookingStatus.Held,
    proofDeadline: new Date(input.createdAt.getTime() + proofWindowMilliseconds),
  };
}
