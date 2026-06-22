import { Controller, Get, Param, Query } from "@nestjs/common";
import { z } from "zod";
import { Public } from "../auth/session.guard.js";
// biome-ignore lint/style/useImportType: AvailabilityService is injected by Nest at runtime.
import { AvailabilityService } from "./availability.service.js";

const availabilityQuerySchema = z.object({
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  durationMin: z.coerce.number().int().min(30).max(720),
});

@Controller({ path: "courts", version: "1" })
export class AvailabilityController {
  constructor(private readonly availability: AvailabilityService) {}

  @Public()
  @Get(":id/availability")
  list(@Param("id") courtId: string, @Query() query: Record<string, string>) {
    const input = availabilityQuerySchema.parse(query);
    return this.availability.listPricedSlots(courtId, input.date, input.durationMin);
  }
}
