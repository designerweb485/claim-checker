import { Router, type Router as ExpressRouter } from "express";
import { appConfig } from "../../config.js";
import { prisma } from "../../db/client.js";

export const healthRouter: ExpressRouter = Router();

healthRouter.get("/", async (_req, res) => {
  let database: "up" | "down" = "down";
  try {
    await prisma.$queryRaw`SELECT 1`;
    database = "up";
  } catch {
    database = "down";
  }
  res.status(database === "up" ? 200 : 503).json({
    status: database === "up" ? "ok" : "degraded",
    product: appConfig.productName,
    database,
  });
});
