/**
 * Capture portfolio screenshots at a real desktop viewport.
 * Usage (API + web already running):
 *   pnpm dlx playwright@1.49.1 install chromium
 *   node scripts/capture-screenshots.mjs
 */
import { chromium } from "playwright";
import { mkdir } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const outDir = join(root, "docs", "screenshots");
const base = process.env.WEB_BASE_URL ?? "http://localhost:3000";
const email = process.env.DEMO_EMAIL ?? "demo@nexxaura.com";
const password = process.env.DEMO_PASSWORD ?? "demo12345";

await mkdir(outDir, { recursive: true });

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({
  viewport: { width: 1440, height: 900 },
  deviceScaleFactor: 1,
});

async function shot(name) {
  const path = join(outDir, name);
  await page.screenshot({ path, fullPage: false });
  console.log("wrote", path);
}

await page.goto(`${base}/login`, { waitUntil: "networkidle" });
await page.waitForTimeout(500);
await shot("01-login.png");

await page.getByLabel("Email").fill(email);
await page.getByLabel("Password").fill(password);
await page.getByRole("button", { name: "Sign in", exact: true }).last().click();
await page.waitForURL("**/dashboard", { timeout: 15000 });
await page.waitForTimeout(800);
await shot("02-dashboard.png");

await page.goto(`${base}/uploads`, { waitUntil: "networkidle" });
await page.waitForTimeout(800);
await shot("05-history.png");

const open = page.getByRole("link", { name: "Open" }).first();
await open.click();
await page.waitForURL(/\/uploads\/[0-9a-f-]{36}$/i, { timeout: 15000 });
await page.waitForTimeout(1000);
await shot("03-upload-detail.png");

const findings = page.getByRole("link", { name: /View all findings/i });
if (await findings.count()) {
  await findings.click();
  await page.waitForURL(/\/findings/, { timeout: 15000 });
  await page.waitForTimeout(1000);
  await shot("04-findings.png");
} else {
  console.warn("No findings link — skipped 04-findings.png");
}

await browser.close();
console.log("done");
