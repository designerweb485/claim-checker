import { Router, type Router as ExpressRouter } from "express";
import bcrypt from "bcryptjs";
import { z } from "zod";
import { writeAudit } from "../../audit.js";
import { prisma } from "../../db/client.js";
import {
  clearSessionCookie,
  requireAuth,
  setSessionCookie,
  signToken,
} from "../../middleware/auth.js";
import { HttpError } from "../../middleware/errors.js";

const registerSchema = z.object({
  organizationName: z.string().trim().min(2).max(120),
  organizationSlug: z
    .string()
    .trim()
    .toLowerCase()
    .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, "Slug must be lowercase alphanumeric with hyphens")
    .min(2)
    .max(64),
  email: z.string().trim().email().max(320),
  password: z.string().min(8).max(200),
});

const loginSchema = z.object({
  email: z.string().trim().email(),
  password: z.string().min(1).max(200),
});

function publicUser(user: {
  id: string;
  email: string;
  role: "owner" | "member";
  organizationId: string;
  organization: { id: string; name: string; slug: string };
}) {
  return {
    id: user.id,
    email: user.email,
    role: user.role,
    organization: {
      id: user.organization.id,
      name: user.organization.name,
      slug: user.organization.slug,
    },
  };
}

export const authRouter: ExpressRouter = Router();

authRouter.post("/register", async (req, res, next) => {
  try {
    const body = registerSchema.parse(req.body);
    const existing = await prisma.user.findUnique({ where: { email: body.email } });
    if (existing) {
      throw new HttpError(409, "Email is already registered", "EMAIL_TAKEN");
    }
    const slugTaken = await prisma.organization.findUnique({
      where: { slug: body.organizationSlug },
    });
    if (slugTaken) {
      throw new HttpError(409, "Organization slug is already taken", "SLUG_TAKEN");
    }

    const passwordHash = await bcrypt.hash(body.password, 10);
    const created = await prisma.$transaction(async (tx) => {
      const organization = await tx.organization.create({
        data: { name: body.organizationName, slug: body.organizationSlug },
      });
      const user = await tx.user.create({
        data: {
          organizationId: organization.id,
          email: body.email,
          passwordHash,
          role: "owner",
        },
        include: { organization: true },
      });
      await writeAudit(tx, {
        organizationId: organization.id,
        actorUserId: user.id,
        action: "auth.register",
        resourceType: "user",
        resourceId: user.id,
        metadata: { email: user.email },
      });
      return user;
    });

    const token = signToken({
      sub: created.id,
      orgId: created.organizationId,
      email: created.email,
      role: created.role,
      tv: created.tokenVersion,
    });
    setSessionCookie(res, token);
    res.status(201).json({ user: publicUser(created), token });
  } catch (e) {
    next(e);
  }
});

authRouter.post("/login", async (req, res, next) => {
  try {
    const body = loginSchema.parse(req.body);
    const user = await prisma.user.findUnique({
      where: { email: body.email },
      include: { organization: true },
    });
    if (!user || !(await bcrypt.compare(body.password, user.passwordHash))) {
      throw new HttpError(401, "Invalid email or password", "INVALID_CREDENTIALS");
    }

    await writeAudit(prisma, {
      organizationId: user.organizationId,
      actorUserId: user.id,
      action: "auth.login",
      resourceType: "user",
      resourceId: user.id,
    });

    const token = signToken({
      sub: user.id,
      orgId: user.organizationId,
      email: user.email,
      role: user.role,
      tv: user.tokenVersion,
    });
    setSessionCookie(res, token);
    res.json({ user: publicUser(user), token });
  } catch (e) {
    next(e);
  }
});

authRouter.post("/logout", requireAuth, async (req, res, next) => {
  try {
    await prisma.user.update({
      where: { id: req.user!.id },
      data: { tokenVersion: { increment: 1 } },
    });
    await writeAudit(prisma, {
      organizationId: req.user!.organizationId,
      actorUserId: req.user!.id,
      action: "auth.logout",
      resourceType: "user",
      resourceId: req.user!.id,
    });
    clearSessionCookie(res);
    res.status(204).send();
  } catch (e) {
    next(e);
  }
});

authRouter.get("/me", requireAuth, async (req, res) => {
  res.json({
    user: {
      id: req.user!.id,
      email: req.user!.email,
      role: req.user!.role,
      organization: {
        id: req.user!.organizationId,
        name: req.user!.organizationName,
        slug: req.user!.organizationSlug,
      },
    },
  });
});
