import type { PrismaClient } from "@courtlink/database";
import { Inject, Module, type OnApplicationShutdown } from "@nestjs/common";
import { Redis } from "ioredis";
import { PRISMA_CLIENT } from "../auth/tokens.js";
import { OperationsService } from "./operations.service.js";
import { PrismaOperationsProbe } from "./prisma-operations.probe.js";

@Module({
  providers: [
    {
      provide: PrismaOperationsProbe,
      useFactory: (prisma: PrismaClient) => {
        const redisUrl = process.env.REDIS_URL;
        if (!redisUrl) throw new Error("REDIS_URL is required");
        const databaseBudgetBytes = Number(process.env.DATABASE_CAPACITY_BYTES ?? 10 * 1024 ** 3);
        return new PrismaOperationsProbe(
          prisma,
          new Redis(redisUrl, { maxRetriesPerRequest: null, connectTimeout: 2_000 }),
          databaseBudgetBytes,
        );
      },
      inject: [PRISMA_CLIENT],
    },
    {
      provide: OperationsService,
      useFactory: (probe: PrismaOperationsProbe) =>
        new OperationsService(probe, Number(process.env.READINESS_TIMEOUT_MS ?? 2_000)),
      inject: [PrismaOperationsProbe],
    },
  ],
  exports: [OperationsService],
})
export class OperationsModule implements OnApplicationShutdown {
  constructor(@Inject(PrismaOperationsProbe) private readonly probe: PrismaOperationsProbe) {}

  async onApplicationShutdown(): Promise<void> {
    await this.probe.close();
  }
}
