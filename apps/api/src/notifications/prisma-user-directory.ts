import type { PrismaClient } from "@courtlink/database";
import type { UserDirectory } from "./notification.dispatcher.js";

export class PrismaUserDirectory implements UserDirectory {
  constructor(private readonly prisma: PrismaClient) {}

  async emailsForUsers(userIds: string[]): Promise<string[]> {
    if (userIds.length === 0) return [];
    const users = await this.prisma.user.findMany({
      where: { id: { in: userIds }, status: "ACTIVE" },
      select: { email: true },
    });
    return users.map((user) => user.email);
  }
}
