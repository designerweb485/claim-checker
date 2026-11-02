/**
 * Upsert synthetic demo login without wiping org data.
 * Usage: node scripts/ensure-demo-user.mjs
 *
 * API tests wipe the shared local DB (same DATABASE_URL as `api dev`).
 * Run this after tests or a migrate reset if demo login stops working.
 */
import bcrypt from "bcryptjs";
import { PrismaClient } from "@prisma/client";

const EMAIL = "demo@nexxaura.com";
const PASSWORD = "demo12345";
const ORG_SLUG = "nexxaura-demo";
const ORG_NAME = "Nexxaura Demo";

const prisma = new PrismaClient();

async function main() {
  const passwordHash = await bcrypt.hash(PASSWORD, 10);

  let org = await prisma.organization.findUnique({ where: { slug: ORG_SLUG } });
  if (!org) {
    org = await prisma.organization.create({
      data: { name: ORG_NAME, slug: ORG_SLUG },
    });
  }

  const existing = await prisma.user.findUnique({ where: { email: EMAIL } });
  if (existing) {
    await prisma.user.update({
      where: { id: existing.id },
      data: { passwordHash },
    });
    console.log("Updated demo user:", EMAIL);
  } else {
    await prisma.user.create({
      data: {
        organizationId: org.id,
        email: EMAIL,
        passwordHash,
        role: "owner",
      },
    });
    console.log("Created demo user:", EMAIL);
  }
  console.log("Demo password:", PASSWORD);
}

main()
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
