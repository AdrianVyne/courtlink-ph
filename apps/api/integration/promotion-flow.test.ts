import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@courtlink/database";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { PrismaPromotionRepository } from "../src/promotions/prisma-promotion.repository.js";
import { PromotionService } from "../src/promotions/promotion.service.js";

const connectionString = process.env.DATABASE_URL;
if (!connectionString) throw new Error("DATABASE_URL is required for promotion integration tests");

const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString }) });
const promotions = new PromotionService(new PrismaPromotionRepository(prisma));

beforeAll(async () => {
  await prisma.$connect();
});
afterAll(async () => {
  await cleanup();
  await prisma.$disconnect();
});
beforeEach(async () => {
  await cleanup();
});

async function cleanup() {
  await prisma.promotion.deleteMany({ where: { venue: { slug: { startsWith: "promo-" } } } });
  await prisma.venue.deleteMany({ where: { slug: { startsWith: "promo-" } } });
  await prisma.business.deleteMany({ where: { name: { startsWith: "PROMO " } } });
}

async function venue() {
  const business = await prisma.business.create({ data: { name: `PROMO ${crypto.randomUUID()}` } });
  return prisma.venue.create({
    data: {
      businessId: business.id,
      name: "Promo Venue",
      slug: `promo-${crypto.randomUUID().slice(0, 8)}`,
      status: "APPROVED",
      approvedAt: new Date(),
      regionCode: "NCR",
      cityMunicipality: "Manila",
      streetAddress: "1 St",
    },
  });
}

describe("Promotions", () => {
  it("creates, lists active within window, and deactivates", async () => {
    const v = await venue();
    const now = new Date("2026-06-15T00:00:00.000Z");

    const live = await promotions.createPromotion({
      venueId: v.id,
      title: "Opening week",
      startsAt: new Date("2026-06-01T00:00:00.000Z"),
      endsAt: new Date("2026-06-30T00:00:00.000Z"),
      discountType: "PERCENT",
      discountValue: 20,
    });
    await promotions.createPromotion({
      venueId: v.id,
      title: "Past deal",
      startsAt: new Date("2026-01-01T00:00:00.000Z"),
      endsAt: new Date("2026-02-01T00:00:00.000Z"),
      discountType: "FIXED",
      discountValue: 100,
    });

    const active = await promotions.listActive(v.id, now);
    expect(active.map((p) => p.title)).toEqual(["Opening week"]);
    expect(active[0]?.discountValue).toBe(20);

    await promotions.deactivate(live.id);
    const afterDeactivate = await promotions.listActive(v.id, now);
    expect(afterDeactivate).toHaveLength(0);

    const all = await promotions.listForVenue(v.id);
    expect(all).toHaveLength(2);
  });
});
