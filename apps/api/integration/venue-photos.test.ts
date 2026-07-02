import {
  type OrganizationRole,
  PlatformRole,
  type PrismaClient,
  VenueStatus,
} from "@courtlink/database";
import { FastifyAdapter, type NestFastifyApplication } from "@nestjs/platform-fastify";
import { Test } from "@nestjs/testing";
import type { FastifyInstance } from "fastify";
import sharp from "sharp";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { AppModule } from "../src/app.module.js";
import { hashSessionToken } from "../src/auth/auth.service.js";
import { SESSION_COOKIE_NAME } from "../src/auth/session.guard.js";
import { OBJECT_STORAGE, PRISMA_CLIENT } from "../src/auth/tokens.js";
import { DomainExceptionFilter } from "../src/common/domain-exception.filter.js";
import { MAX_PROOF_BYTES, type ObjectStorage } from "../src/storage/object-storage.js";

const connectionString = process.env.DATABASE_URL;
if (!connectionString) throw new Error("DATABASE_URL is required for venue photo tests");

const TEST_EMAIL = { endsWith: "@venue-photos.integration.test" } as const;
const TEST_BUSINESS_NAME = { startsWith: "VPHOTO " } as const;
const TEST_VENUE_SLUG = { startsWith: "vphoto-" } as const;

type ManageRole = Extract<OrganizationRole, "OWNER" | "MANAGER">;
type ImageKind = "jpeg" | "png" | "webp";

interface StoredObject {
  body: Buffer;
  contentType: string;
}

interface ImageFixture {
  buffer: Buffer;
  contentType: "image/jpeg" | "image/png" | "image/webp";
  filename: string;
}

interface UploadedPhotoResponse {
  id: string;
  altText: string;
  position: number;
}

class MemoryObjectStorage implements ObjectStorage {
  readonly objects = new Map<string, StoredObject>();
  readonly signedRequests: Array<{ key: string; expiresInSeconds: number }> = [];

  reset(): void {
    this.objects.clear();
    this.signedRequests.length = 0;
  }

  async putObject(input: { key: string; body: Buffer; contentType: string }): Promise<void> {
    this.objects.set(input.key, {
      body: Buffer.from(input.body),
      contentType: input.contentType,
    });
  }

  async getSignedDownloadUrl(key: string, expiresInSeconds: number): Promise<string> {
    this.signedRequests.push({ key, expiresInSeconds });
    return `https://storage.test/${key}?expires=${expiresInSeconds}`;
  }
}

const storage = new MemoryObjectStorage();

let app: NestFastifyApplication;
let server: FastifyInstance;
let prisma: PrismaClient;
let images: Record<ImageKind, ImageFixture>;

beforeAll(async () => {
  images = await buildImages();

  const moduleRef = await Test.createTestingModule({ imports: [AppModule] })
    .overrideProvider(OBJECT_STORAGE)
    .useValue(storage)
    .compile();

  prisma = moduleRef.get<PrismaClient>(PRISMA_CLIENT);
  app = moduleRef.createNestApplication<NestFastifyApplication>(
    new FastifyAdapter({ logger: false }),
  );
  app.setGlobalPrefix("api/v1");
  app.useGlobalFilters(new DomainExceptionFilter({ error: () => undefined }));

  const multipart = await import("@fastify/multipart");
  await app.register(multipart.default as never, {
    limits: { fileSize: MAX_PROOF_BYTES, files: 1 },
  });
  await app.init();
  server = app.getHttpAdapter().getInstance();
  await server.ready();
});

afterAll(async () => {
  await cleanup();
  await app.close();
});

beforeEach(async () => {
  storage.reset();
  await cleanup();
});

async function cleanup() {
  const users = await prisma.user.findMany({ where: { email: TEST_EMAIL }, select: { id: true } });
  const userIds = users.map((user) => user.id);
  if (userIds.length > 0) {
    await prisma.idempotencyRecord.deleteMany({ where: { actorId: { in: userIds } } });
  }
  await prisma.venuePhoto.deleteMany({ where: { venue: { slug: TEST_VENUE_SLUG } } });
  await prisma.venue.deleteMany({ where: { slug: TEST_VENUE_SLUG } });
  await prisma.businessMembership.deleteMany({
    where: { business: { name: TEST_BUSINESS_NAME } },
  });
  await prisma.business.deleteMany({ where: { name: TEST_BUSINESS_NAME } });
  await prisma.session.deleteMany({ where: { user: { email: TEST_EMAIL } } });
  await prisma.userPlatformRole.deleteMany({ where: { user: { email: TEST_EMAIL } } });
  await prisma.passwordCredential.deleteMany({ where: { user: { email: TEST_EMAIL } } });
  await prisma.user.deleteMany({ where: { email: TEST_EMAIL } });
}

async function buildImages(): Promise<Record<ImageKind, ImageFixture>> {
  const create = () =>
    sharp({
      create: {
        width: 4,
        height: 4,
        channels: 3,
        background: { r: 47, g: 125, b: 83 },
      },
    });
  return {
    jpeg: {
      buffer: await create().jpeg().toBuffer(),
      contentType: "image/jpeg",
      filename: "court.jpg",
    },
    png: {
      buffer: await create().png().toBuffer(),
      contentType: "image/png",
      filename: "court.png",
    },
    webp: {
      buffer: await create().webp().toBuffer(),
      contentType: "image/webp",
      filename: "court.webp",
    },
  };
}

async function createUser(label: string) {
  return prisma.user.create({
    data: {
      email: `${label}-${crypto.randomUUID()}@venue-photos.integration.test`,
      displayName: label,
      roles: { create: { role: PlatformRole.PLAYER } },
    },
  });
}

async function createSessionCookie(userId: string): Promise<string> {
  const token = `test-session-${crypto.randomUUID()}`;
  await prisma.session.create({
    data: {
      userId,
      tokenHash: hashSessionToken(token),
      expiresAt: new Date(Date.now() + 60 * 60 * 1000),
    },
  });
  return `${SESSION_COOKIE_NAME}=${token}`;
}

async function createManagedVenue(role: ManageRole, status: VenueStatus = VenueStatus.DRAFT) {
  const user = await createUser(role.toLowerCase());
  const business = await prisma.business.create({
    data: {
      name: `VPHOTO ${crypto.randomUUID()}`,
      memberships: { create: { userId: user.id, role } },
    },
  });
  const venue = await prisma.venue.create({
    data: {
      businessId: business.id,
      name: `VPHOTO Venue ${crypto.randomUUID()}`,
      slug: `vphoto-${crypto.randomUUID().slice(0, 8)}`,
      regionCode: "NCR",
      cityMunicipality: "Quezon City",
      streetAddress: "123 Test Ave",
      status,
      ...(status === VenueStatus.APPROVED
        ? { approvedAt: new Date("2026-07-02T00:00:00.000Z") }
        : {}),
    },
  });
  return { user, business, venue, cookie: await createSessionCookie(user.id) };
}

function buildMultipart(input: { altText: string; image: ImageFixture }) {
  const boundary = `----courtlink-${crypto.randomUUID()}`;
  const chunks: Buffer[] = [];
  const append = (value: string | Buffer) => {
    chunks.push(Buffer.isBuffer(value) ? value : Buffer.from(value, "utf8"));
  };

  append(`--${boundary}\r\n`);
  append('Content-Disposition: form-data; name="altText"\r\n\r\n');
  append(`${input.altText}\r\n`);
  append(`--${boundary}\r\n`);
  append(`Content-Disposition: form-data; name="file"; filename="${input.image.filename}"\r\n`);
  append(`Content-Type: ${input.image.contentType}\r\n\r\n`);
  append(input.image.buffer);
  append(`\r\n--${boundary}--\r\n`);

  return {
    payload: Buffer.concat(chunks),
    contentType: `multipart/form-data; boundary=${boundary}`,
  };
}

function parseJson<T>(body: string): T {
  return JSON.parse(body) as T;
}

describe("Venue photos API", () => {
  it.each([
    { role: "OWNER" as const, kind: "jpeg" as const },
    { role: "MANAGER" as const, kind: "png" as const },
    { role: "OWNER" as const, kind: "webp" as const },
  ])("allows $role to upload a valid $kind venue photo with alt text", async ({ role, kind }) => {
    const { venue, cookie } = await createManagedVenue(role);
    const multipart = buildMultipart({
      altText: "Outdoor court under evening lights",
      image: images[kind],
    });

    const response = await server.inject({
      method: "POST",
      url: `/api/v1/venues/${venue.id}/photos`,
      headers: {
        cookie,
        "content-type": multipart.contentType,
        "idempotency-key": crypto.randomUUID(),
      },
      payload: multipart.payload,
    });

    expect(response.statusCode).toBe(201);
    const body = parseJson<UploadedPhotoResponse>(response.body);
    expect(body).toMatchObject({
      altText: "Outdoor court under evening lights",
      position: 0,
    });
    expect(body.id).toMatch(/^[0-9a-f-]{36}$/i);

    const storedPhoto = await prisma.venuePhoto.findUniqueOrThrow({ where: { id: body.id } });
    expect(storedPhoto.venueId).toBe(venue.id);
    expect(storedPhoto.altText).toBe("Outdoor court under evening lights");
    expect(storedPhoto.position).toBe(0);
    expect(storedPhoto.objectKey).toMatch(new RegExp(`^venue-photos/${venue.id}/.+\\.webp$`));
    expect(Array.from(storage.objects.values())).toEqual([
      expect.objectContaining({ contentType: "image/webp" }),
    ]);
  });

  it("denies photo mutations by users outside the venue business", async () => {
    const { venue } = await createManagedVenue("OWNER");
    const stranger = await createUser("stranger");
    const cookie = await createSessionCookie(stranger.id);
    const multipart = buildMultipart({
      altText: "Outdoor court under evening lights",
      image: images.jpeg,
    });

    const response = await server.inject({
      method: "POST",
      url: `/api/v1/venues/${venue.id}/photos`,
      headers: {
        cookie,
        "content-type": multipart.contentType,
        "idempotency-key": crypto.randomUUID(),
      },
      payload: multipart.payload,
    });

    expect(response.statusCode).toBe(403);
    expect(parseJson<{ code: string }>(response.body).code).toBe("TENANT_FORBIDDEN");
    await expect(prisma.venuePhoto.count({ where: { venueId: venue.id } })).resolves.toBe(0);
    expect(storage.objects.size).toBe(0);
  });

  it("redirects public requests for approved venue photos with a cache header", async () => {
    const { venue } = await createManagedVenue("OWNER", VenueStatus.APPROVED);
    const photo = await prisma.venuePhoto.create({
      data: {
        venueId: venue.id,
        objectKey: `venue-photos/${venue.id}/published.webp`,
        altText: "Outdoor court under evening lights",
        position: 0,
      },
    });

    const response = await server.inject({
      method: "GET",
      url: `/api/v1/venue-photos/${photo.id}`,
    });

    expect(response.statusCode).toBe(302);
    expect(response.headers["cache-control"]).toBe("public, max-age=86400");
    expect(response.headers.location).toBe(`https://storage.test/${photo.objectKey}?expires=86400`);
    expect(storage.signedRequests).toEqual([{ key: photo.objectKey, expiresInSeconds: 86400 }]);
  });
});
