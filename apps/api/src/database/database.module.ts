import { PrismaClient } from "@courtlink/database";
import { PrismaPg } from "@prisma/adapter-pg";
import { Global, Module, type OnApplicationShutdown } from "@nestjs/common";
import { Inject } from "@nestjs/common";
import { PRISMA_CLIENT } from "../auth/tokens.js";

@Global()
@Module({
  providers: [
    {
      provide: PRISMA_CLIENT,
      useFactory: () => {
        const connectionString = process.env.DATABASE_URL;
        if (!connectionString) throw new Error("DATABASE_URL is required");
        return new PrismaClient({ adapter: new PrismaPg({ connectionString }) });
      },
    },
  ],
  exports: [PRISMA_CLIENT],
})
export class DatabaseModule implements OnApplicationShutdown {
  constructor(@Inject(PRISMA_CLIENT) private readonly prisma: PrismaClient) {}

  async onApplicationShutdown(): Promise<void> {
    await this.prisma.$disconnect();
  }
}
