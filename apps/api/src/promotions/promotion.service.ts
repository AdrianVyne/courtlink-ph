export type DiscountType = "PERCENT" | "FIXED";

export interface PromotionRecord {
  id: string;
  venueId: string;
  title: string;
  description: string | null;
  startsAt: Date;
  endsAt: Date;
  discountType: DiscountType;
  discountValue: number;
  active: boolean;
}

export interface CreatePromotionInput {
  venueId: string;
  title: string;
  description?: string | null;
  startsAt: Date;
  endsAt: Date;
  discountType: DiscountType;
  discountValue: number;
}

export interface PromotionRepository {
  create(input: CreatePromotionInput): Promise<PromotionRecord>;
  listForVenue(venueId: string): Promise<PromotionRecord[]>;
  listActive(venueId: string, now: Date): Promise<PromotionRecord[]>;
  getById(id: string): Promise<PromotionRecord | null>;
  setActive(id: string, active: boolean): Promise<PromotionRecord>;
}

export class PromotionError extends Error {
  readonly code: string;
  constructor(code: string, message: string) {
    super(message);
    this.code = code;
    this.name = "PromotionError";
  }
}

// PERCENT is 1..100; FIXED is a positive peso amount. The window must be a
// non-empty future-or-present range.
export function validatePromotion(input: {
  startsAt: Date;
  endsAt: Date;
  discountType: DiscountType;
  discountValue: number;
}): void {
  if (input.endsAt.getTime() <= input.startsAt.getTime()) {
    throw new PromotionError("PROMOTION_RANGE_INVALID", "endsAt must be after startsAt");
  }
  if (input.discountValue <= 0) {
    throw new PromotionError("PROMOTION_VALUE_INVALID", "Discount must be greater than zero");
  }
  if (input.discountType === "PERCENT" && input.discountValue > 100) {
    throw new PromotionError("PROMOTION_PERCENT_INVALID", "Percent discount cannot exceed 100");
  }
}

export function isPromotionActive(promotion: PromotionRecord, now: Date): boolean {
  return (
    promotion.active &&
    promotion.startsAt.getTime() <= now.getTime() &&
    promotion.endsAt.getTime() > now.getTime()
  );
}

export class PromotionService {
  constructor(private readonly repository: PromotionRepository) {}

  createPromotion(input: CreatePromotionInput): Promise<PromotionRecord> {
    validatePromotion(input);
    return this.repository.create({ ...input, title: input.title.trim() });
  }

  listForVenue(venueId: string): Promise<PromotionRecord[]> {
    return this.repository.listForVenue(venueId);
  }

  listActive(venueId: string, now: Date = new Date()): Promise<PromotionRecord[]> {
    return this.repository.listActive(venueId, now);
  }

  async deactivate(id: string): Promise<PromotionRecord> {
    const existing = await this.repository.getById(id);
    if (!existing) throw new PromotionError("PROMOTION_NOT_FOUND", "Promotion not found");
    return this.repository.setActive(id, false);
  }

  async venueOf(id: string): Promise<string | null> {
    const promotion = await this.repository.getById(id);
    return promotion?.venueId ?? null;
  }
}
