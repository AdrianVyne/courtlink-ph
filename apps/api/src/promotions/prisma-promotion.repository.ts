import type { PrismaClient } from "@courtlink/database";
import type {
  CreatePromotionInput,
  DiscountType,
  PromotionRecord,
  PromotionRepository,
} from "./promotion.service.js";

type PromotionRow = {
  id: string;
  venueId: string;
  title: string;
  description: string | null;
  startsAt: Date;
  endsAt: Date;
  discountType: string;
  discountValue: { toString(): string } | number | string;
  active: boolean;
};

function toRecord(row: PromotionRow): PromotionRecord {
  return {
    id: row.id,
    venueId: row.venueId,
    title: row.title,
    description: row.description,
    startsAt: row.startsAt,
    endsAt: row.endsAt,
    discountType: row.discountType as DiscountType,
    discountValue: Number(row.discountValue),
    active: row.active,
  };
}

export class PrismaPromotionRepository implements PromotionRepository {
  constructor(private readonly prisma: PrismaClient) {}

  async create(input: CreatePromotionInput): Promise<PromotionRecord> {
    const row = await this.prisma.promotion.create({
      data: {
        venueId: input.venueId,
        title: input.title,
        description: input.description ?? null,
        startsAt: input.startsAt,
        endsAt: input.endsAt,
        discountType: input.discountType,
        discountValue: input.discountValue.toFixed(2),
      },
    });
    return toRecord(row);
  }

  async listForVenue(venueId: string): Promise<PromotionRecord[]> {
    const rows = await this.prisma.promotion.findMany({
      where: { venueId },
      orderBy: { startsAt: "desc" },
    });
    return rows.map(toRecord);
  }

  async listActive(venueId: string, now: Date): Promise<PromotionRecord[]> {
    const rows = await this.prisma.promotion.findMany({
      where: { venueId, active: true, startsAt: { lte: now }, endsAt: { gt: now } },
      orderBy: { startsAt: "asc" },
    });
    return rows.map(toRecord);
  }

  async getById(id: string): Promise<PromotionRecord | null> {
    const row = await this.prisma.promotion.findUnique({ where: { id } });
    return row ? toRecord(row) : null;
  }

  async setActive(id: string, active: boolean): Promise<PromotionRecord> {
    const row = await this.prisma.promotion.update({ where: { id }, data: { active } });
    return toRecord(row);
  }
}
