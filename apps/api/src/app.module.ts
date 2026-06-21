import { Module } from "@nestjs/common";
import { AuthModule } from "./auth/auth.module.js";
import { CourtModule } from "./courts/court.module.js";
import { HealthController } from "./health/health.controller.js";
import { TenancyModule } from "./tenancy/tenancy.module.js";
import { VenueModule } from "./venues/venue.module.js";

@Module({
  imports: [AuthModule, TenancyModule, VenueModule, CourtModule],
  controllers: [HealthController],
})
export class AppModule {}
