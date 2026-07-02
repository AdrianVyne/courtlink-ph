import { Controller, Get } from "@nestjs/common";
import { Public } from "../auth/session.guard.js";
// biome-ignore lint/style/useImportType: PublicStatsService is a Nest runtime injection token.
import { PublicStatsService } from "./public-stats.service.js";
import type { PublicStats } from "./public-stats.service.js";

@Public()
@Controller({ path: "stats", version: "1" })
export class PublicStatsController {
  constructor(private readonly stats: PublicStatsService) {}

  @Get("public")
  getPublicStats(): Promise<PublicStats> {
    return this.stats.getPublicStats();
  }
}
