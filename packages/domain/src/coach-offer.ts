export enum CoachOfferStatus {
  Active = "active",
  Withdrawn = "withdrawn",
}

export interface CoachOfferAcceptanceInput {
  status: CoachOfferStatus;
  expiresAt: Date;
  now: Date;
}

export function canAcceptCoachOffer(input: CoachOfferAcceptanceInput): boolean {
  return (
    input.status === CoachOfferStatus.Active && input.now.getTime() < input.expiresAt.getTime()
  );
}
