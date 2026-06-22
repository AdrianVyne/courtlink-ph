import { Module } from "@nestjs/common";
import { AmenityModule } from "./amenities/amenity.module.js";
import { AuthModule } from "./auth/auth.module.js";
import { CoachModule } from "./coaches/coach.module.js";
import { CourtModule } from "./courts/court.module.js";
import { DatabaseModule } from "./database/database.module.js";
import { HealthController } from "./health/health.controller.js";
import { IdempotencyModule } from "./idempotency/idempotency.module.js";
import { NotificationModule } from "./notifications/notification.module.js";
import { OperationsModule } from "./operations/operations.module.js";
import { FavoriteModule } from "./favorites/favorite.module.js";
import { ModerationModule } from "./moderation/moderation.module.js";
import { PromotionModule } from "./promotions/promotion.module.js";
import { ReviewModule } from "./reviews/review.module.js";
import { StorageModule } from "./storage/storage.module.js";
import { TenancyModule } from "./tenancy/tenancy.module.js";
import { VenueModule } from "./venues/venue.module.js";

@Module({
  imports: [
    DatabaseModule,
    IdempotencyModule,
    StorageModule,
    AmenityModule,
    AuthModule,
    TenancyModule,
    VenueModule,
    CourtModule,
    CoachModule,
    NotificationModule,
    OperationsModule,
    ReviewModule,
    ModerationModule,
    FavoriteModule,
    PromotionModule,
  ],
  controllers: [HealthController],
})
export class AppModule {}
