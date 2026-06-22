import { describe, expect, it } from "vitest";
import {
  type CreatePromotionInput,
  type PromotionRecord,
  type PromotionRepository,
  PromotionError,
  PromotionService,
  isPromotionActive,
  validatePromotion,
} from "./promotion.service.js";

class FakePromotionRepo implements PromotionRepository {
  rows: PromotionRecord[] = [];
  async create(input: CreatePromotionInput) {
    const row: PromotionRecord = {
      id: `promo-${this.rows.length + 1}`,
      venueId: input.venueId,
      title: input.title,
      description: input.description ?? null,
      startsAt: input.startsAt,
      endsAt: input.endsAt,
      discountType: input.discountType,
      discountValue: input.discountValue,
      active: true,
    };
    this.rows.push(row);
    return row;
  }
  async listForVenue(venueId: string) {
    return this.rows.filter((r) => r.venueId === venueId);
  }
  async listActive(venueId: string, now: Date) {
    return this.rows.filter((r) => r.venueId === venueId && isPromotionActive(r, now));
  }
  async getById(id: string) {
    return this.rows.find((r) => r.id === id) ?? null;
  }
  async setActive(id: string, active: boolean) {
    const row = this.rows.find((r) => r.id === id);
    if (!row) throw new PromotionError("PROMOTION_NOT_FOUND", "missing");
    row.active = active;
    return row;
  }
}

function input(overrides: Partial<CreatePromotionInput> = {}): CreatePromotionInput {
  return {
    venueId: "v1",
    title: "Opening week",
    startsAt: new Date("2026-06-01T00:00:00.000Z"),
    endsAt: new Date("2026-06-30T00:00:00.000Z"),
    discountType: "PERCENT",
    discountValue: 20,
    ...overrides,
  };
}

describe("validatePromotion", () => {
  it("rejects bad ranges, non-positive values, and over-100 percents", () => {
    expect(() => validatePromotion({ ...input(), endsAt: new Date("2026-05-01") })).toThrow(
      PromotionError,
    );
    expect(() => validatePromotion({ ...input(), discountValue: 0 })).toThrow(PromotionError);
    expect(() =>
      validatePromotion({ ...input(), discountType: "PERCENT", discountValue: 150 }),
    ).toThrow(PromotionError);
    expect(() => validatePromotion(input())).not.toThrow();
    expect(() =>
      validatePromotion({ ...input(), discountType: "FIXED", discountValue: 500 }),
    ).not.toThrow();
  });
});

describe("isPromotionActive", () => {
  it("is active only inside the window and when flagged active", async () => {
    const repo = new FakePromotionRepo();
    const service = new PromotionService(repo);
    const promo = await service.createPromotion(input());
    expect(isPromotionActive(promo, new Date("2026-06-15T00:00:00.000Z"))).toBe(true);
    expect(isPromotionActive(promo, new Date("2026-07-15T00:00:00.000Z"))).toBe(false);
    await service.deactivate(promo.id);
    expect(isPromotionActive(promo, new Date("2026-06-15T00:00:00.000Z"))).toBe(false);
  });
});

describe("PromotionService.listActive", () => {
  it("only returns promotions inside their active window", async () => {
    const repo = new FakePromotionRepo();
    const service = new PromotionService(repo);
    await service.createPromotion(input({ title: "live" }));
    await service.createPromotion(
      input({ title: "past", startsAt: new Date("2026-01-01"), endsAt: new Date("2026-02-01") }),
    );
    const active = await service.listActive("v1", new Date("2026-06-15T00:00:00.000Z"));
    expect(active.map((p) => p.title)).toEqual(["live"]);
  });
});
