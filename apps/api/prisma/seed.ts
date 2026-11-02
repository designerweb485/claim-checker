/**
 * Synthetic seed data only — not real patients, credentials, or PHI.
 */
import bcrypt from "bcryptjs";
import { PrismaClient, UserRole, UploadStatus } from "@prisma/client";

const prisma = new PrismaClient();

/** Local demo login — synthetic only. */
const DEMO_EMAIL = "demo@nexxaura.com";
const DEMO_PASSWORD = "demo12345";

async function main() {
  await prisma.auditLog.deleteMany();
  await prisma.validationFinding.deleteMany();
  await prisma.validationRun.deleteMany();
  await prisma.diagnosis.deleteMany();
  await prisma.claimLine.deleteMany();
  await prisma.claim.deleteMany();
  await prisma.upload.deleteMany();
  await prisma.user.deleteMany();
  await prisma.organization.deleteMany();

  const passwordHash = await bcrypt.hash(DEMO_PASSWORD, 10);

  const orgA = await prisma.organization.create({
    data: { name: "Nexxaura Demo", slug: "nexxaura-demo" },
  });
  const orgB = await prisma.organization.create({
    data: { name: "Other Org Synthetic", slug: "other-org" },
  });

  const userA = await prisma.user.create({
    data: {
      organizationId: orgA.id,
      email: DEMO_EMAIL,
      passwordHash,
      role: UserRole.owner,
    },
  });

  await prisma.user.create({
    data: {
      organizationId: orgB.id,
      email: "user@other-org.example",
      passwordHash,
      role: UserRole.owner,
    },
  });

  await prisma.upload.create({
    data: {
      organizationId: orgA.id,
      userId: userA.id,
      filename: "demo-pending.edi",
      byteSize: 128,
      contentHash: "sha256:synthetic-pending",
      storageKey: "uploads/synthetic/demo-pending.edi",
      status: UploadStatus.pending,
    },
  });

  console.log("Seeded synthetic orgs:", orgA.slug, orgB.slug);
  console.log("Demo login:", DEMO_EMAIL, "/", DEMO_PASSWORD);
}

main()
  .then(() => prisma.$disconnect())
  .catch(async (e) => {
    console.error(e);
    await prisma.$disconnect();
    process.exit(1);
  });
