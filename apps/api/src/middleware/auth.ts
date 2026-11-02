import type { NextFunction, Request, Response } from "express";
import jwt from "jsonwebtoken";
import { appConfig } from "../config.js";
import { prisma } from "../db/client.js";
import { HttpError } from "./errors.js";

export type AuthUser = {
  id: string;
  email: string;
  role: "owner" | "member";
  organizationId: string;
  organizationName: string;
  organizationSlug: string;
};

export type JwtPayload = {
  sub: string;
  orgId: string;
  email: string;
  role: "owner" | "member";
  /** Must match User.tokenVersion or the session is rejected. */
  tv: number;
};

declare global {
  namespace Express {
    interface Request {
      user?: AuthUser;
    }
  }
}

export function signToken(payload: JwtPayload): string {
  return jwt.sign(payload, appConfig.jwtSecret, { expiresIn: "7d" });
}

export function setSessionCookie(res: Response, token: string) {
  res.cookie(appConfig.cookieName, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: appConfig.nodeEnv === "production",
    maxAge: 7 * 24 * 60 * 60 * 1000,
    path: "/",
  });
}

export function clearSessionCookie(res: Response) {
  res.clearCookie(appConfig.cookieName, {
    httpOnly: true,
    sameSite: "lax",
    secure: appConfig.nodeEnv === "production",
    path: "/",
  });
}

function extractToken(req: Request): string | undefined {
  const header = req.headers.authorization;
  if (header?.startsWith("Bearer ")) {
    return header.slice("Bearer ".length).trim();
  }
  const cookie = req.cookies?.[appConfig.cookieName];
  return typeof cookie === "string" ? cookie : undefined;
}

export async function requireAuth(req: Request, _res: Response, next: NextFunction) {
  try {
    const token = extractToken(req);
    if (!token) {
      throw new HttpError(401, "Authentication required", "UNAUTHORIZED");
    }

    let payload: JwtPayload;
    try {
      payload = jwt.verify(token, appConfig.jwtSecret) as JwtPayload;
    } catch {
      throw new HttpError(401, "Invalid or expired session", "UNAUTHORIZED");
    }

    const user = await prisma.user.findUnique({
      where: { id: payload.sub },
      include: { organization: true },
    });
    if (
      !user ||
      user.organizationId !== payload.orgId ||
      payload.tv !== user.tokenVersion
    ) {
      throw new HttpError(401, "Invalid or expired session", "UNAUTHORIZED");
    }

    // Organization is always taken from the authenticated user — never from client body/query.
    req.user = {
      id: user.id,
      email: user.email,
      role: user.role,
      organizationId: user.organizationId,
      organizationName: user.organization.name,
      organizationSlug: user.organization.slug,
    };
    next();
  } catch (e) {
    next(e);
  }
}
