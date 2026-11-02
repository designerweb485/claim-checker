import { config as loadEnv } from "dotenv";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const apiRoot = join(dirname(fileURLToPath(import.meta.url)), "..");
loadEnv({ path: join(apiRoot, ".env") });
loadEnv({ path: join(apiRoot, "../../.env") });

function intEnv(name: string, fallback: number): number {
  const raw = process.env[name];
  if (!raw) return fallback;
  const n = Number.parseInt(raw, 10);
  return Number.isFinite(n) ? n : fallback;
}

export const appConfig = {
  nodeEnv: process.env.NODE_ENV ?? "development",
  port: intEnv("API_PORT", 3001),
  corsOrigin: process.env.API_CORS_ORIGIN ?? "http://localhost:3000",
  jwtSecret: process.env.JWT_SECRET ?? "dev-only-change-me",
  cookieName: process.env.COOKIE_NAME ?? "cc_session",
  uploadMaxBytes: intEnv("UPLOAD_MAX_BYTES", 2_097_152),
  uploadDir: resolve(process.env.UPLOAD_DIR ?? join(apiRoot, "uploads")),
  productName: process.env.PRODUCT_NAME ?? "Claim Checker",
};
