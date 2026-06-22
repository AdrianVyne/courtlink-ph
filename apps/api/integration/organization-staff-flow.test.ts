import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@courtlink/database";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { OrganizationStaffService } from "../src/tenancy/organization-staff.service.js";
import { PrismaOrganizationStaffRepository } from "../src/tenancy/prisma-organization-staff.repository.js";
import { TenancyService } from "../src/tenancy/tenancy.service.js";
import { PrismaTenancyRepository } from "../src/tenancy/prisma-tenancy.repository.js";
import type { EmailMessage, EmailSender } from "../src/notifications/notification.service.js";

const connectionString = process.env.DATABASE_URL;
if (!connectionString) throw new Error("DATABASE_URL is required for org staff tests");

const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString }) });

class CaptureEmail implements EmailSender {
  sent: EmailMessage[] = [];
  async send(message: EmailMessage): Promise<void> {
    this.sent.push(message);
  }
}

function buildStaff(email: EmailSender) {
  return new OrganizationStaffService(
    new PrismaOrganizationStaffRepository(prisma),
    email,
    "https://app.test",
  );
}

beforeAll(async () => {
  await prisma.$connect();
});
afterAll(async () => {
  await cleanup();
  await prisma.$disconnect();
});
beforeEach(async () => {
  await cleanup();
});

async function cleanup() {
  await prisma.auditEvent.deleteMany({
    where: { actor: { email: { endsWith: "@orgstaff.test" } } },
  });
  await prisma.staffInvitation.deleteMany({ where: { email: { endsWith: "@orgstaff.test" } } });
  await prisma.businessMembership.deleteMany({
    where: { business: { name: { startsWith: "ORGSTAFF " } } },
  });
  await prisma.business.deleteMany({ where: { name: { startsWith: "ORGSTAFF " } } });
  await prisma.user.deleteMany({ where: { email: { endsWith: "@orgstaff.test" } } });
}

async function makeUser(label: string) {
  return prisma.user.create({
    data: {
      email: `${label}-${crypto.randomUUID()}@orgstaff.test`,
      displayName: label,
      credentials: { create: { passwordHash: "$argon2id$placeholder" } },
    },
  });
}

async function makeBusiness(ownerId: string) {
  return prisma.business.create({
    data: {
      name: `ORGSTAFF ${crypto.randomUUID()}`,
      memberships: { create: { userId: ownerId, role: "OWNER" } },
    },
  });
}

describe("Organization staff lifecycle", () => {
  it("invites, accepts, audits, and the new member can be managed", async () => {
    const email = new CaptureEmail();
    const staff = buildStaff(email);
    const owner = await makeUser("owner");
    const invitee = await makeUser("invitee");
    const business = await makeBusiness(owner.id);

    const token = await staff.inviteStaff(
      { businessId: business.id, email: invitee.email, role: "STAFF" },
      { id: owner.id, role: "OWNER" },
    );
    expect(email.sent).toHaveLength(1);

    await staff.acceptInvitation(token, { id: invitee.id, email: invitee.email });
    const membership = await prisma.businessMembership.findUnique({
      where: { businessId_userId: { businessId: business.id, userId: invitee.id } },
    });
    expect(membership?.role).toBe("STAFF");
    expect(membership?.status).toBe("ACTIVE");

    const audit = await staff.listAuditEvents(business.id);
    expect(audit.some((a) => a.action === "ORG_STAFF_INVITED")).toBe(true);
    expect(audit.some((a) => a.action === "ORG_STAFF_JOINED")).toBe(true);
  });

  it("suspends a member so tenant authorization is denied, then reinstates", async () => {
    const email = new CaptureEmail();
    const staff = buildStaff(email);
    const tenancy = new TenancyService(new PrismaTenancyRepository(prisma));
    const owner = await makeUser("owner");
    const member = await makeUser("member");
    const business = await makeBusiness(owner.id);
    await prisma.businessMembership.create({
      data: { businessId: business.id, userId: member.id, role: "STAFF" },
    });

    await staff.suspendMembership(business.id, member.id, { id: owner.id, role: "OWNER" });
    await expect(
      tenancy.assertRole(member.id, business.id, ["OWNER", "MANAGER", "STAFF"]),
    ).rejects.toMatchObject({ code: "TENANT_FORBIDDEN" });

    await staff.reinstateMembership(business.id, member.id, { id: owner.id, role: "OWNER" });
    const reinstated = await tenancy.assertRole(member.id, business.id, ["STAFF"]);
    expect(reinstated.status).toBe("ACTIVE");
  });

  it("protects the last active owner from removal", async () => {
    const email = new CaptureEmail();
    const staff = buildStaff(email);
    const owner = await makeUser("owner");
    const business = await makeBusiness(owner.id);
    await expect(
      staff.removeMembership(business.id, owner.id, { id: owner.id, role: "OWNER" }),
    ).rejects.toMatchObject({ code: "LAST_OWNER_PROTECTED" });
  });

  it("removes a staff member and records an audit event", async () => {
    const email = new CaptureEmail();
    const staff = buildStaff(email);
    const owner = await makeUser("owner");
    const member = await makeUser("member");
    const business = await makeBusiness(owner.id);
    await prisma.businessMembership.create({
      data: { businessId: business.id, userId: member.id, role: "STAFF" },
    });

    await staff.removeMembership(business.id, member.id, { id: owner.id, role: "OWNER" });
    const gone = await prisma.businessMembership.findUnique({
      where: { businessId_userId: { businessId: business.id, userId: member.id } },
    });
    expect(gone).toBeNull();
    const audit = await staff.listAuditEvents(business.id);
    expect(audit.some((a) => a.action === "ORG_MEMBER_REMOVED")).toBe(true);
  });
});
