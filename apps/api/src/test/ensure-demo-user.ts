/**
 * Upsert synthetic demo login (shared by test teardown).
 * Does not wipe other orgs/uploads.
 */
import bcrypt from "bcryptjs";
import { PrismaClient } from "@prisma/client";

export const DEMO_EMAIL = "demo@nexxaura.com";
export const DEMO_PASSWORD = "demo12345";
const ORG_SLUG = "nexxaura-demo";
const ORG_NAME = "Nexxaura Demo";

export async function ensureDemoUser(prisma?: PrismaClient) {
  const client = prisma ?? new PrismaClient();
  const shouldDisconnect = !prisma;
  try {
    const passwordHash = await bcrypt.hash(DEMO_PASSWORD, 10);

    let org = await client.organization.findUnique({ where: { slug: ORG_SLUG } });
    if (!org) {
      org = await client.organization.create({
        data: { name: ORG_NAME, slug: ORG_SLUG },
      });
    }

    const existing = await client.user.findUnique({ where: { email: DEMO_EMAIL } });
    if (existing) {
      await client.user.update({
        where: { id: existing.id },
        data: { passwordHash },
      });
    } else {
      await client.user.create({
        data: {
          organizationId: org.id,
          email: DEMO_EMAIL,
          passwordHash,
          role: "owner",
        },
      });
    }
  } finally {
    if (shouldDisconnect) await client.$disconnect();
  }
}
