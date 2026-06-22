import { PrismaPg } from "@prisma/adapter-pg";
import { argon2id, hash } from "argon2";
import { PrismaClient } from "../generated/client/client.js";

const connectionString =
  process.env.DATABASE_URL ?? "postgresql://courtlink:courtlink@localhost:5433/courtlink";

const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString }) });

const DEMO_PASSWORD = "courtlink-demo-2026";

function hashPassword(password: string): Promise<string> {
  return hash(password, { type: argon2id, memoryCost: 19_456, timeCost: 2, parallelism: 1 });
}

async function upsertUser(input: {
  email: string;
  displayName: string;
  passwordHash: string;
  superAdmin?: boolean;
}) {
  const user = await prisma.user.upsert({
    where: { email: input.email },
    update: {
      displayName: input.displayName,
      credentials: {
        upsert: {
          create: { passwordHash: input.passwordHash },
          update: { passwordHash: input.passwordHash },
        },
      },
    },
    create: {
      email: input.email,
      displayName: input.displayName,
      credentials: { create: { passwordHash: input.passwordHash } },
    },
  });
  if (input.superAdmin) {
    await prisma.userPlatformRole.upsert({
      where: { userId_role: { userId: user.id, role: "SUPER_ADMIN" } },
      update: {},
      create: { userId: user.id, role: "SUPER_ADMIN" },
    });
  }
  return user;
}

async function main() {
  const passwordHash = await hashPassword(DEMO_PASSWORD);

  const owner = await upsertUser({
    email: "owner@demo.courtlink.ph",
    displayName: "Demo Venue Owner",
    passwordHash,
  });
  await upsertUser({
    email: "player@demo.courtlink.ph",
    displayName: "Demo Player",
    passwordHash,
  });
  const coachUser = await upsertUser({
    email: "coach@demo.courtlink.ph",
    displayName: "Demo Coach",
    passwordHash,
  });
  await upsertUser({
    email: "admin@demo.courtlink.ph",
    displayName: "Demo Super Admin",
    passwordHash,
    superAdmin: true,
  });

  let business = await prisma.business.findFirst({ where: { name: "Demo Pickleball Co" } });
  if (!business) {
    business = await prisma.business.create({
      data: {
        name: "Demo Pickleball Co",
        memberships: { create: { userId: owner.id, role: "OWNER" } },
      },
    });
  }

  const venue = await prisma.venue.upsert({
    where: { slug: "riverside-pickleball-demo" },
    update: { status: "APPROVED", approvedAt: new Date() },
    create: {
      businessId: business.id,
      name: "Riverside Pickleball",
      slug: "riverside-pickleball-demo",
      description: "Four covered courts beside the river, open daily.",
      status: "APPROVED",
      approvedAt: new Date(),
      regionCode: "NCR",
      cityMunicipality: "Pasig",
      streetAddress: "12 Riverside Drive",
    },
  });

  const existingCourt = await prisma.court.findFirst({
    where: { venueId: venue.id, name: "Court 1" },
  });
  const court =
    existingCourt ??
    (await prisma.court.create({
      data: {
        venueId: venue.id,
        name: "Court 1",
        description: "Championship court with covered roof.",
        indoor: true,
        slotIncrementMin: 30,
        minimumDurationMin: 60,
        maximumDurationMin: 180,
      },
    }));

  const hasRule = await prisma.courtPricingRule.findFirst({ where: { courtId: court.id } });
  if (!hasRule) {
    await prisma.courtPricingRule.create({
      data: {
        courtId: court.id,
        startsMinute: 0,
        endsMinute: 24 * 60,
        pricePerHour: "250.00",
        priority: 0,
      },
    });
  }

  await prisma.$transaction([
    prisma.courtOperatingHour.deleteMany({ where: { courtId: court.id } }),
    prisma.courtOperatingHour.createMany({
      data: Array.from({ length: 7 }, (_, dayOfWeek) => ({
        courtId: court.id,
        dayOfWeek,
        opensMinute: 8 * 60,
        closesMinute: 22 * 60,
      })),
    }),
  ]);

  const venueAmenityKeys = ["PARKING", "SHOWERS", "CAFE"];
  const courtAmenityKeys = ["INDOOR", "COURT_LIGHTS"];
  const venueAmenities = await prisma.amenity.findMany({
    where: { key: { in: venueAmenityKeys } },
  });
  const courtAmenities = await prisma.amenity.findMany({
    where: { key: { in: courtAmenityKeys } },
  });
  await prisma.$transaction([
    prisma.venueAmenity.deleteMany({ where: { venueId: venue.id } }),
    prisma.venueAmenity.createMany({
      data: venueAmenities.map((amenity) => ({ venueId: venue.id, amenityId: amenity.id })),
      skipDuplicates: true,
    }),
    prisma.courtAmenity.deleteMany({ where: { courtId: court.id } }),
    prisma.courtAmenity.createMany({
      data: courtAmenities.map((amenity) => ({ courtId: court.id, amenityId: amenity.id })),
      skipDuplicates: true,
    }),
  ]);

  await prisma.coachProfile.upsert({
    where: { userId: coachUser.id },
    update: { verificationStatus: "VERIFIED", hourlyRate: "800.00", active: true },
    create: {
      userId: coachUser.id,
      bio: "PPA-certified coach focused on beginners and intermediate doubles.",
      experience: "8 years coaching across Metro Manila.",
      hourlyRate: "800.00",
      verificationStatus: "VERIFIED",
    },
  });

  process.stdout.write(
    `Seed complete. Demo login password for all demo accounts: ${DEMO_PASSWORD}\n`,
  );
}

main()
  .catch((error: unknown) => {
    process.stderr.write(`${error instanceof Error ? error.stack : String(error)}\n`);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
